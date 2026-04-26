import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import {
  contract, erc20, signerFromWalletRow, safeEstimateGas,
  explorerTx, parseCOIN, formatCOIN, withSlippage
} from '@chainbot/shared';
import { getWallet, getTokenBySymbol } from '../lib/db.js';
import { error, BRAND_COLOR, BRAND_FOOTER } from '../lib/discord.js';

export const data = new SlashCommandBuilder()
  .setName('liquidity')
  .setDescription('Add liquidity to the DEX')
  .addSubcommand(sub =>
    sub.setName('add')
       .setDescription('Add COIN + token liquidity to a Uniswap V2 pool')
       .addStringOption(opt =>
         opt.setName('token')
            .setDescription('Token ticker to pair with COIN (e.g. DOGE)')
            .setRequired(true)
       )
       .addNumberOption(opt =>
         opt.setName('coin_amount')
            .setDescription('Amount of COIN to deposit')
            .setMinValue(0.000001)
            .setRequired(true)
       )
       .addNumberOption(opt =>
         opt.setName('token_amount')
            .setDescription('Amount of token to deposit')
            .setMinValue(0.000001)
            .setRequired(true)
       )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const walletRow = await getWallet(interaction.user.id);
  if (!walletRow) return interaction.editReply({ embeds: [error("No wallet found. Use `/wallet create` first.")] });
  if (!walletRow.is_custodial) return interaction.editReply({ embeds: [error('View-only wallets cannot add liquidity.')] });

  const ticker = interaction.options.getString('token', true).toUpperCase();
  const coinAmount = interaction.options.getNumber('coin_amount', true);
  const tokenAmount = interaction.options.getNumber('token_amount', true);

  const tokenRow = await getTokenBySymbol(ticker);
  let tokenAddress = tokenRow?.address;
  if (!tokenAddress) {
    try {
      tokenAddress = await (contract('MemeCoinFactory') as any).getTokenBySymbol(ticker);
      if (!tokenAddress || tokenAddress === ethers.ZeroAddress) throw new Error();
    } catch {
      return interaction.editReply({ embeds: [error(`Token **${ticker}** not found.`)] });
    }
  }

  try {
    const signer = signerFromWalletRow(walletRow);
    const router = contract('UniswapV2Router', signer);
    const tk = erc20(tokenAddress, signer);
    const decimals = Number(await (tk as any).decimals());
    const routerAddr = await (router as any).getAddress();

    const coinAmtWei = parseCOIN(coinAmount.toString(), 18);
    const tokenAmtWei = parseCOIN(tokenAmount.toString(), decimals);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    // Approve token
    const allowance = await (tk as any).allowance(walletRow.address, routerAddr);
    if (allowance < tokenAmtWei) {
      const appTx = await (tk as any).approve(routerAddr, ethers.MaxUint256);
      await appTx.wait(1);
    }

    // Add liquidity (COIN is native, so use addLiquidityETH)
    const tx = await safeEstimateGas(
      (router as any).addLiquidityETH(
        tokenAddress,
        tokenAmtWei,
        withSlippage(tokenAmtWei),   // min token
        withSlippage(coinAmtWei),    // min ETH
        walletRow.address,
        deadline,
        { value: coinAmtWei }
      )
    );
    const receipt = await tx.wait(1);

    if (!receipt) throw new Error('Transaction failed to confirm.');

    // Parse LP tokens received from logs
    let lpReceived = 'check explorer';
    try {
      const iface = new ethers.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === 'Transfer' && parsed.args.to.toLowerCase() === walletRow.address.toLowerCase()) {
            lpReceived = `${formatCOIN(parsed.args.value, 18)} LP tokens`;
            break;
          }
        } catch { /* not our event */ }
      }
    } catch { /* skip */ }

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('💧 Liquidity Added!')
      .addFields(
        { name: '🪙 COIN Deposited', value: `${coinAmount}`, inline: true },
        { name: `🔷 ${ticker} Deposited`, value: `${tokenAmount}`, inline: true },
        { name: '🎫 LP Tokens', value: lpReceived, inline: false },
        { name: '🔗 Transaction', value: `[View on Explorer](${explorerTx(receipt.hash)})`, inline: false },
      )
      .setFooter({ text: BRAND_FOOTER })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    return interaction.editReply({ embeds: [error(err.message ?? 'Failed to add liquidity.')] });
  }
}
