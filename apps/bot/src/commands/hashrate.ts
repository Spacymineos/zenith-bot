import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { contract } from '@chainbot/shared';
import { getWallet } from '../lib/db.js';
import {
  error,
  BRAND_COLOR, BRAND_FOOTER, HASH_EMOJI
} from '../lib/discord.js';

export const data = new SlashCommandBuilder()
  .setName('hashrate')
  .setDescription("Check a miner's submitted hashrate and rank")
  .addUserOption(opt =>
    opt.setName('user')
       .setDescription('Target user (defaults to yourself)')
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
          ? "You don't have a wallet yet. Use `/wallet create` first."
          : `${targetUser.displayName} doesn't have a wallet linked.`
      )],
    });
  }

  try {
    const registry = contract('MinerRegistry');
    const [rawHashrate, rankData] = await Promise.all([
      (registry as any).getHashrate(walletRow.address),
      (registry as any).getMinerRank(walletRow.address),
    ]);

    const hashrate = Number(rawHashrate);
    const rank = Number(rankData.rank);
    const total = Number(rankData.total);
    const topPercent = total > 0 ? ((rank / total) * 100).toFixed(1) : '—';

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle(`${HASH_EMOJI} Miner Stats — ${targetUser.displayName}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '⚡ Hashrate', value: `**${hashrate.toLocaleString()} H/s**`, inline: true },
        { name: '🏅 Rank', value: `**#${rank}** of ${total}`, inline: true },
        { name: '📊 Top %', value: `Top **${topPercent}%**`, inline: true },
        { name: '📬 Address', value: `\`${walletRow.address}\``, inline: false },
      )
      .setFooter({ text: BRAND_FOOTER })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    return interaction.editReply({
      embeds: [error(`Failed to fetch hashrate data: ${err.message}`)],
    });
  }
}
