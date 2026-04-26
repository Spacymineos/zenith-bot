import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import { contract, getProvider } from '@chainbot/shared';
import { pool } from '../lib/db.js';
import {
  error, base, fmtCoin, shortAddr, rankEmoji,
  BRAND_COLOR, BRAND_FOOTER
} from '../lib/discord.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View top rankings')
  .addSubcommand(sub =>
    sub.setName('miners')
       .setDescription('Top 10 miners by hashrate')
  )
  .addSubcommand(sub =>
    sub.setName('rich')
       .setDescription('Top 10 COIN holders')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();
  const provider = getProvider();

  // ── MINERS ─────────────────────────────────────────────────────────────────
  if (sub === 'miners') {
    try {
      const registry = contract('MinerRegistry');
      const [miners, hashrates] = await (registry as any).getTopMiners(10);

      if (!miners.length) {
        return interaction.editReply({
          embeds: [base('⛏️ Miner Leaderboard', 'No miners registered yet. Be the first!')],
        });
      }

      // Try to resolve discord usernames from DB
      const addrRows = await pool.query(
        'SELECT discord_id, address FROM wallets WHERE address = ANY($1)',
        [miners.map((a: string) => a.toLowerCase())]
      );
      const addrMap = Object.fromEntries(addrRows.rows.map(r => [r.address, r.discord_id]));

      const lines = miners.map((addr: string, i: number) => {
        const hs = Number(hashrates[i]).toLocaleString();
        const discordId = addrMap[addr.toLowerCase()];
        const name = discordId ? `<@${discordId}>` : `\`${shortAddr(addr)}\``;
        return `${rankEmoji(i)} ${name} — **${hs} H/s**`;
      });

      const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('⛏️ Top 10 Miners')
        .setDescription(lines.join('\n'))
        .setFooter({ text: BRAND_FOOTER })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      return interaction.editReply({
        embeds: [error(`Failed to fetch miner leaderboard: ${err.message}`)],
      });
    }
  }

  // ── RICH ───────────────────────────────────────────────────────────────────
  if (sub === 'rich') {
    try {
      // Fetch all known wallets from DB and sort by on-chain balance
      const { rows } = await pool.query('SELECT discord_id, address FROM wallets LIMIT 200');

      const balances = await Promise.all(
        rows.map(async (row: any) => {
          try {
            const bal = await provider.getBalance(row.address);
            return { ...row, balance: bal };
          } catch {
            return { ...row, balance: 0n };
          }
        })
      );

      balances.sort((a, b) => (b.balance > a.balance ? 1 : -1));
      const top10 = balances.slice(0, 10);

      if (!top10.length) {
        return interaction.editReply({
          embeds: [base('💰 Rich List', 'No wallets found yet!')],
        });
      }

      const lines = top10.map((w, i) => {
        const amt = fmtCoin(parseFloat(ethers.formatEther(w.balance)));
        const name = w.discord_id ? `<@${w.discord_id}>` : `\`${shortAddr(w.address)}\``;
        return `${rankEmoji(i)} ${name} — **${amt} 🪙**`;
      });

      const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('💰 Top 10 COIN Holders')
        .setDescription(lines.join('\n'))
        .setFooter({ text: BRAND_FOOTER })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      return interaction.editReply({
        embeds: [error(`Failed to fetch rich list: ${err.message}`)],
      });
    }
  }
}
