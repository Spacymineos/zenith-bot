import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import { contract, erc20, uniswapPair } from '../core.js';
import { getTokenBySymbol, error, fmtUSD, BRAND_COLOR, BRAND_FOOTER, getErrorMessage } from '../core.js';

export const data = new SlashCommandBuilder().setName('price').setDescription('Live price data')
  .addStringOption(opt => opt.setName('ticker').setDescription('Symbol (ZENITH, DOGE...)').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const ticker = interaction.options.getString('ticker', true).toUpperCase().trim();

  if (ticker === 'COIN' || ticker === 'ZENITH') {
    try {
      const oracle = contract('PriceOracle');
      const [rawPrice, rawChange] = await Promise.all([oracle.getNativePrice(), oracle.get24hChange(ethers.ZeroAddress).catch(() => 0n)]);
      const price = parseFloat(ethers.formatUnits(rawPrice, 8));
      const change = (Number(rawChange) / 100).toFixed(2);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(BRAND_COLOR).setTitle('🪙 Zenith Coin — Native Token').addFields({ name: '💲 Price', value: fmtUSD(price), inline: true }, { name: '📈 24h', value: `**${Number(change) >= 0 ? '+' : ''}${change}%**`, inline: true }).setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
    } catch (err: unknown) { return interaction.editReply({ embeds: [error(`Failed: ${getErrorMessage(err)}`)] }); }
  }

  let tokenAddress = (await getTokenBySymbol(ticker))?.address;
  if (!tokenAddress) {
    try {
      tokenAddress = await contract('MemeCoinFactory').getTokenBySymbol(ticker);
      if (!tokenAddress || tokenAddress === ethers.ZeroAddress) throw new Error();
    } catch { return interaction.editReply({ embeds: [error(`Token **${ticker}** not found.`)] }); }
  }

  try {
    const tk = erc20(tokenAddress), oracle = contract('PriceOracle');
    const [name, symbol, supply, decimals, pairAddr, rawNativePrice] = await Promise.all([tk.name(), tk.symbol(), tk.totalSupply(), tk.decimals(), contract('UniswapV2Factory').getPair(tokenAddress, await contract('UniswapV2Router').WETH()), oracle.getNativePrice().catch(() => 0n)]);
    const nativeUSD = parseFloat(ethers.formatUnits(rawNativePrice, 8));
    let price = 0, marketCap = 0;

    if (pairAddr && pairAddr !== ethers.ZeroAddress) {
      const pair = uniswapPair(pairAddr);
      const [res, t0] = await Promise.all([pair.getReserves(), pair.token0()]);
      const isTok0 = t0.toLowerCase() === tokenAddress.toLowerCase();
      const [r0, r1] = isTok0 ? [res.reserve0, res.reserve1] : [res.reserve1, res.reserve0];
      if (r0 > 0n) {
        price = (parseFloat(ethers.formatUnits(r1, 18)) / parseFloat(ethers.formatUnits(r0, Number(decimals)))) * nativeUSD;
        marketCap = price * parseFloat(ethers.formatUnits(supply, Number(decimals)));
      }
    }

    let changeStr = '—';
    try {
      const rc = await oracle.get24hChange(tokenAddress);
      const c = (Number(rc) / 100).toFixed(2);
      changeStr = `${Number(c) >= 0 ? '+' : ''}${c}%`;
    } catch {}

    return interaction.editReply({ embeds: [new EmbedBuilder().setColor(BRAND_COLOR).setTitle(`📊 ${name} (${symbol})`).addFields({ name: '💲 Price', value: price > 0 ? fmtUSD(price) : 'No liquidity', inline: true }, { name: '📈 24h Change', value: changeStr, inline: true }, { name: '🏦 Market Cap', value: marketCap > 0 ? fmtUSD(marketCap) : '—', inline: true }, { name: '📋 Contract', value: `\`${tokenAddress}\``, inline: false }).setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
  } catch (err: unknown) { return interaction.editReply({ embeds: [error(`Failed: ${getErrorMessage(err)}`)] }); }
}


