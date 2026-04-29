import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import { contract, getProvider, shortAddr, fmtCoin, prisma } from '../core.js';
import { error, base, BRAND_COLOR, BRAND_FOOTER, getErrorMessage } from '../core.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboard').setDescription('Rankings')
  .addSubcommand(sub => sub.setName('miners').setDescription('Top 10 miners by hashrate'))
  .addSubcommand(sub => sub.setName('rich').setDescription('Top 10 Zenith Coin holders'));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand();
  const provider = getProvider();

  if (sub === 'miners') {
    try {
      const registry = contract('MinerRegistry');
      const [miners, hashrates] = await registry.getTopMiners(10);
      if (!miners.length) return interaction.editReply({ embeds: [base('⛏️ Miner Leaderboard', 'No miners yet.')] });

      const wallets = await prisma.wallet.findMany({
        where: { address: { in: miners.map((a: string) => a.toLowerCase()) } },
        select: { discordId: true, address: true }
      });
      const addrMap = Object.fromEntries(wallets.map(w => [w.address.toLowerCase(), w.discordId]));

      const lines = miners.map((addr: string, i: number) => {
        const hs = Number(hashrates[i]).toLocaleString();
        const discordId = addrMap[addr.toLowerCase()];
        const name = discordId ? `<@${discordId}>` : `\`${shortAddr(addr)}\``;
        return `**#${i+1}** ${name} — **${hs} H/s**`;
      });

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(BRAND_COLOR).setTitle('⛏️ Top 10 Miners').setDescription(lines.join('\n')).setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
    } catch (err: unknown) {
      return interaction.editReply({ embeds: [error(`Failed to fetch miner leaderboard: ${getErrorMessage(err)}`)] });
    }
  }

  if (sub === 'rich') {
    try {
      const wallets = await prisma.wallet.findMany({
        take: 200,
        select: { discordId: true, address: true }
      });
      const balances = await Promise.all(wallets.map(async (w: { discordId: string; address: string }) => {
        try { return { ...w, balance: await provider.getBalance(w.address) }; } catch { return { ...w, balance: 0n }; }
      }));

      balances.sort((a, b) => (b.balance > a.balance ? 1 : -1));
      const top10 = balances.slice(0, 10);
      if (!top10.length) return interaction.editReply({ embeds: [base('💰 Rich List', 'No wallets found.')] });

      const lines = top10.map((w, i) => {
        const amt = fmtCoin(parseFloat(ethers.formatEther(w.balance)));
        const name = w.discordId ? `<@${w.discordId}>` : `\`${shortAddr(w.address)}\``;
        return `**#${i+1}** ${name} — **${amt} 🪙**`;
      });

      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(BRAND_COLOR).setTitle('💰 Top 10 Rich List').setDescription(lines.join('\n')).setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
    } catch (err: unknown) {
      return interaction.editReply({ embeds: [error(`Failed to fetch rich list: ${getErrorMessage(err)}`)] });
    }
  }
}


