import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import { contract, erc20, signerFromWalletRow, safeEstimateGas, explorerTx, parseCOIN, withSlippage } from '../core.js';
import { getWallet, getTokenBySymbol, error, BRAND_FOOTER, getErrorMessage } from '../core.js';

async function resolveToken(ticker: string) {
  if (ticker.toUpperCase() === 'COIN' || ticker.toUpperCase() === 'ZENITH') return { isNative: true, address: null, decimals: 18 };
  const row = await getTokenBySymbol(ticker);
  if (row) return { isNative: false, address: row.address, decimals: Number(await erc20(row.address).decimals()) };
  const addr = await contract('MemeCoinFactory').getTokenBySymbol(ticker).catch(() => null);
  if (addr && addr !== ethers.ZeroAddress) return { isNative: false, address: addr, decimals: Number(await erc20(addr).decimals()) };
  return null;
}

export const data = new SlashCommandBuilder().setName('swap').setDescription('Swap via DEX')
  .addStringOption(opt => opt.setName('from_token').setDescription('Sell').setRequired(true))
  .addStringOption(opt => opt.setName('to_token').setDescription('Buy').setRequired(true))
  .addNumberOption(opt => opt.setName('amount').setDescription('Amount').setRequired(true))
  .addIntegerOption(opt => opt.setName('slippage').setDescription('BPS (50 = 0.5%)'));
export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const walletRow = await getWallet(interaction.user.id);
  if (!walletRow?.isCustodial) return interaction.editReply({ embeds: [error('Need custodial wallet.')] });

  const fromT = interaction.options.getString('from_token', true).toUpperCase(), toT = interaction.options.getString('to_token', true).toUpperCase();
  const amount = interaction.options.getNumber('amount', true), slippage = BigInt(interaction.options.getInteger('slippage') ?? 50);
  if (fromT === toT) return interaction.editReply({ embeds: [error('Same token.')] });

  const [fTok, tTok] = await Promise.all([resolveToken(fromT), resolveToken(toT)]);
  if (!fTok || !tTok) return interaction.editReply({ embeds: [error('Token not found.')] });

  try {
    const signer = signerFromWalletRow(walletRow), router = contract('UniswapV2Router', signer), weth = await router.WETH();
    const fAddr = fTok.isNative ? weth : fTok.address!, tAddr = tTok.isNative ? weth : tTok.address!;
    const path = fAddr.toLowerCase() === tAddr.toLowerCase() ? [fAddr, tAddr] : [fAddr, weth, tAddr].filter((v, i, a) => a.indexOf(v) === i);
    const amountIn = parseCOIN(amount.toString(), fTok.decimals), amounts = await router.getAmountsOut(amountIn, path);
    const amountOutMin = withSlippage(amounts[amounts.length - 1]!, slippage), deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    if (!fTok.isNative) {
      const tk = erc20(fAddr, signer);
      if (await tk.allowance(walletRow.address, await router.getAddress()) < amountIn) await (await tk.approve(await router.getAddress(), ethers.MaxUint256)).wait(1);
    }

    const tx = await safeEstimateGas(fTok.isNative ? router.swapExactETHForTokens(amountOutMin, path, walletRow.address, deadline, { value: amountIn }) : tTok.isNative ? router.swapExactTokensForETH(amountIn, amountOutMin, path, walletRow.address, deadline) : router.swapExactTokensForTokens(amountIn, amountOutMin, path, walletRow.address, deadline));
    const receipt = await tx.wait(1);
    return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('🔄 Swap Success!').setDescription(`Swapped **${amount} ${fromT}** for tokens.`).addFields({ name: '🔗 Tx', value: `[View](${explorerTx(receipt!.hash)})` }).setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
  } catch (err: unknown) { return interaction.editReply({ embeds: [error(`Failed: ${getErrorMessage(err)}`)] }); }
}


