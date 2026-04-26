import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import {
  contract, erc20, uniswapPair
} from '@chainbot/shared';
import { getTokenBySymbol } from '../lib/db.js';
import { error, fmtUSD, BRAND_COLOR, BRAND_FOOTER } from '../lib/discord.js';

export const data = new SlashCommandBuilder()
  .setName('price')
  .setDescription('Get live price data for any token')
  .addStringOption(opt =>
    opt.setName('ticker')
       .setDescription('Token symbol (e.g. COIN, DOGE) — use COIN for native token')
       .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const ticker = interaction.options.getString('ticker', true).toUpperCase().trim();

  // ── Native COIN price ──────────────────────────────────────────────────────
  if (ticker === 'COIN') {
    try {
      const oracle = contract('PriceOracle');
      const [rawPrice, rawChange] = await Promise.all([
        (oracle as any).getNativePrice(),
        (oracle as any).get24hChange(ethers.ZeroAddress).catch(() => 0n),
      ]);
      const price = parseFloat(ethers.formatUnits(rawPrice, 8));
      const change = (Number(rawChange) / 100).toFixed(2);
      const changeStr = Number(change) >= 0 ? `+${change}%` : `${change}%`;
      const emoji = Number(change) >= 0 ? '📈' : '📉';

      const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('🪙 COIN — Native Token')
        .addFields(
          { name: '💲 Price (USD)', value: fmtUSD(price), inline: true },
          { name: `${emoji} 24h`, value: `**${changeStr}**`, inline: true },
          { name: '⛓️ Chain ID', value: '`13371`', inline: true },
        )
        .setFooter({ text: BRAND_FOOTER })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      return interaction.editReply({ embeds: [error(`Failed to fetch COIN price: ${err.message}`)] });
    }
  }

  // ── ERC-20 token price ─────────────────────────────────────────────────────
  const tokenRow = await getTokenBySymbol(ticker);
  let tokenAddress = tokenRow?.address;

  if (!tokenAddress) {
    try {
      tokenAddress = await (contract('MemeCoinFactory') as any).getTokenBySymbol(ticker);
      if (!tokenAddress || tokenAddress === ethers.ZeroAddress) throw new Error('Not found');
    } catch {
      return interaction.editReply({ embeds: [error(`Token **${ticker}** not found.`)] });
    }
  }

  try {
    const tk = erc20(tokenAddress);
    const router = contract('UniswapV2Router');
    const weth = await (router as any).WETH();
    const oracle = contract('PriceOracle');

    const [name, symbol, supply, decimals, pairAddr, rawNativePrice] = await Promise.all([
      (tk as any).name(), (tk as any).symbol(), (tk as any).totalSupply(), (tk as any).decimals(),
      (contract('UniswapV2Factory') as any).getPair(tokenAddress, weth),
      (oracle as any).getNativePrice().catch(() => 0n),
    ]);

    const nativeUSD = parseFloat(ethers.formatUnits(rawNativePrice, 8));
    let price = 0, marketCap = 0;

    if (pairAddr && pairAddr !== ethers.ZeroAddress) {
      const pair = uniswapPair(pairAddr);
      const [res, t0] = await Promise.all([(pair as any).getReserves(), (pair as any).token0()]);
      const isTok0 = t0.toLowerCase() === tokenAddress.toLowerCase();
      const r0 = isTok0 ? res.reserve0 : res.reserve1;
      const r1 = isTok0 ? res.reserve1 : res.reserve0;
      if (r0 > 0n) {
        const priceWETH = parseFloat(ethers.formatUnits(r1, 18)) / parseFloat(ethers.formatUnits(r0, Number(decimals)));
        price = priceWETH * nativeUSD;
        const supplyNum = parseFloat(ethers.formatUnits(supply, Number(decimals)));
        marketCap = price * supplyNum;
      }
    }

    let changeStr = '—';
    try {
      const rawChange = await (oracle as any).get24hChange(tokenAddress);
      const change = (Number(rawChange) / 100).toFixed(2);
      changeStr = Number(change) >= 0 ? `+${change}%` : `${change}%`;
    } catch { /* oracle may not track this token yet */ }

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle(`📊 ${name} (${symbol})`)
      .addFields(
        { name: '💲 Price (USD)', value: price > 0 ? fmtUSD(price) : 'No liquidity', inline: true },
        { name: '📈 24h Change', value: changeStr, inline: true },
        { name: '🏦 Market Cap', value: marketCap > 0 ? fmtUSD(marketCap) : '—', inline: true },
        { name: '📋 Contract', value: `\`${tokenAddress}\``, inline: false },
      )
      .setFooter({ text: BRAND_FOOTER })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    return interaction.editReply({ embeds: [error(`Failed to fetch price data: ${err.message}`)] });
  }
}
