import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import { getProvider, contract, erc20, formatCOIN } from '@chainbot/shared';
import { getWallet } from '../lib/db.js';
import { error, fmtCoin, fmtUSD, BRAND_COLOR, BRAND_FOOTER } from '../lib/discord.js';

// Common ERC-20 tokens to always check (populate with real addresses)
const TRACKED_TOKENS: { symbol: string; address: string }[] = [
  // { symbol: 'USDC', address: '0x...' },
];

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('View your COIN balance and all token holdings with USD values')
  .addUserOption(opt =>
    opt.setName('user')
       .setDescription('Check another user\'s balance (optional)')
       .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const targetUser = interaction.options.getUser('user') ?? interaction.user;
  const walletRow = await getWallet(targetUser.id);

  if (!walletRow) {
    const isOwn = targetUser.id === interaction.user.id;
    return interaction.editReply({
      embeds: [error(
        isOwn
          ? "You don't have a wallet yet. Use `/wallet create` to get started!"
          : `${targetUser.displayName} doesn't have a wallet yet.`
      )],
    });
  }

  const address = walletRow.address;
  const provider = getProvider();

  // ── Fetch native balance ───────────────────────────────────────────────────
  let nativeBalance: number, nativeUSD: number, nativePrice: number;
  try {
    const [rawBalance, rawPrice] = await Promise.all([
      provider.getBalance(address),
      (contract('PriceOracle') as any).getNativePrice(),
    ]);
    nativeBalance = parseFloat(ethers.formatEther(rawBalance));
    nativePrice = parseFloat(ethers.formatUnits(rawPrice, 8)); // assume 8 dec oracle
    nativeUSD = nativeBalance * nativePrice;
  } catch {
    nativeBalance = 0;
    nativePrice = 0;
    nativeUSD = 0;
  }

  // ── Fetch ERC-20 balances ──────────────────────────────────────────────────
  const tokenRows: { name: string; symbol: string; amount: number; price: number; usd: number }[] = [];
  let totalUSD = nativeUSD;

  for (const tok of TRACKED_TOKENS) {
    try {
      const tkContract = erc20(tok.address);
      const [rawBal, decimals, tokenName, rawPrice] = await Promise.all([
        (tkContract as any).balanceOf(address),
        (tkContract as any).decimals(),
        (tkContract as any).name(),
        (contract('PriceOracle') as any).getPrice(tok.address).catch(() => 0n),
      ]);
      if (rawBal === 0n) continue;
      const amount = parseFloat(ethers.formatUnits(rawBal, decimals));
      const price = parseFloat(ethers.formatUnits(rawPrice, 8));
      const usd = amount * price;
      totalUSD += usd;
      tokenRows.push({ name: tokenName, symbol: tok.symbol, amount, price, usd });
    } catch { /* skip unresponsive tokens */ }
  }

  // ── Build embed ────────────────────────────────────────────────────────────
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`💰 ${targetUser.displayName}'s Wallet`)
    .setThumbnail(targetUser.displayAvatarURL())
    .setDescription(`**Address:** \`${address}\`${walletRow.is_custodial ? ' 🔐' : ' 👁️ view-only'}`)
    .setFooter({ text: BRAND_FOOTER })
    .setTimestamp();

  // Native COIN row
  embed.addFields({
    name: `🪙 COIN (native)`,
    value: [
      `**Amount:** ${fmtCoin(nativeBalance)}`,
      `**Price:** ${fmtUSD(nativePrice)}`,
      `**Value:** ${fmtUSD(nativeUSD)}`,
    ].join('\n'),
    inline: true,
  });

  // Token rows
  for (const tok of tokenRows) {
    embed.addFields({
      name: `🔷 ${tok.name} (${tok.symbol})`,
      value: [
        `**Amount:** ${fmtCoin(tok.amount)}`,
        `**Price:** ${fmtUSD(tok.price)}`,
        `**Value:** ${fmtUSD(tok.usd)}`,
      ].join('\n'),
      inline: true,
    });
  }

  embed.addFields({
    name: '📊 Total Portfolio Value',
    value: `**${fmtUSD(totalUSD)}**`,
    inline: false,
  });

  return interaction.editReply({ embeds: [embed] });
}
