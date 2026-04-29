import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import { contract, erc20, signerFromWalletRow, safeEstimateGas, explorerTx, parseCOIN, formatCOIN, withSlippage } from '../core.js';
import { getWallet, getTokenBySymbol, error, BRAND_COLOR, BRAND_FOOTER, getErrorMessage } from '../core.js';

export const data = new SlashCommandBuilder()
  .setName('liquidity').setDescription('Add liquidity to the DEX')
  .addSubcommand(sub => sub.setName('add').setDescription('Add Zenith Coin + token liquidity')
    .addStringOption(opt => opt.setName('token').setDescription('Token ticker').setRequired(true))
    .addNumberOption(opt => opt.setName('coin_amount').setDescription('Amount of Zenith Coin').setMinValue(0.000001).setRequired(true))
    .addNumberOption(opt => opt.setName('token_amount').setDescription('Amount of token').setMinValue(0.000001).setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const walletRow = await getWallet(interaction.user.id);
  if (!walletRow) return interaction.editReply({ embeds: [error("No wallet found.")] });
  if (!walletRow.isCustodial) return interaction.editReply({ embeds: [error('View-only wallets cannot add liquidity.')] });

  const ticker = interaction.options.getString('token', true).toUpperCase();
  const coinAmount = interaction.options.getNumber('coin_amount', true);
  const tokenAmount = interaction.options.getNumber('token_amount', true);

  let tokenAddress = (await getTokenBySymbol(ticker))?.address;
  if (!tokenAddress) {
    try {
      tokenAddress = await contract('MemeCoinFactory').getTokenBySymbol(ticker);
      if (!tokenAddress || tokenAddress === ethers.ZeroAddress) throw new Error();
    } catch { return interaction.editReply({ embeds: [error(`Token **${ticker}** not found.`)] }); }
  }

  try {
    const signer = signerFromWalletRow(walletRow);
    const router = contract('UniswapV2Router', signer);
    const tk = erc20(tokenAddress, signer);
    const decimals = Number(await tk.decimals());
    const routerAddr = await router.getAddress();
    const coinAmtWei = parseCOIN(coinAmount.toString(), 18);
    const tokenAmtWei = parseCOIN(tokenAmount.toString(), decimals);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    if (await tk.allowance(walletRow.address, routerAddr) < tokenAmtWei) {
      await (await tk.approve(routerAddr, ethers.MaxUint256)).wait(1);
    }

    const tx = await safeEstimateGas(router.addLiquidityETH(tokenAddress, tokenAmtWei, withSlippage(tokenAmtWei), withSlippage(coinAmtWei), walletRow.address, deadline, { value: coinAmtWei }));
    const receipt = await tx.wait(1);
    if (!receipt) throw new Error('Tx failed');

    return interaction.editReply({ embeds: [new EmbedBuilder().setColor(BRAND_COLOR).setTitle('💧 Liquidity Added!').setDescription(`Added **${coinAmount} Zenith Coin** and **${tokenAmount} ${ticker}** to pool.`).addFields({ name: '🔗 Tx', value: `[View](${explorerTx(receipt.hash)})` }).setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
  } catch (err: unknown) { return interaction.editReply({ embeds: [error(`Failed: ${getErrorMessage(err)}`)] }); }
}


