import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { contract } from '../core.js';
import { getWallet, error, BRAND_COLOR, BRAND_FOOTER, getErrorMessage } from '../core.js';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription("Check a user's validation stats and network rank")
  .addUserOption(opt => opt.setName('user').setDescription('Target user (defaults to yourself)'));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('user') ?? interaction.user;
  const walletRow = await getWallet(targetUser.id);

  if (!walletRow) {
    const isOwn = targetUser.id === interaction.user.id;
    return interaction.editReply({ embeds: [error(isOwn ? "No wallet found. Use `/wallet create` first." : `${targetUser.displayName} doesn't have a wallet.`)] });
  }

  try {
    const registry = contract('MinerRegistry');
    const [rawPower, rankData] = await Promise.all([registry.getHashrate(walletRow.address), registry.getMinerRank(walletRow.address)]);
    const power = Number(rawPower);
    const rank = Number(rankData.rank);
    const total = Number(rankData.total);
    const topPercent = total > 0 ? ((rank / total) * 100).toFixed(1) : '—';

    const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle(`🛡️ Validation Stats — ${targetUser.displayName}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .addFields(
        { name: '⚡ Power', value: `**${power.toLocaleString()} VP**`, inline: true },
        { name: '🏅 Rank', value: `**#${rank}** of ${total}`, inline: true },
        { name: '📊 Top %', value: `Top **${topPercent}%**`, inline: true },
        { name: '📬 Address', value: `\`${walletRow.address}\``, inline: false },
      ).setFooter({ text: BRAND_FOOTER }).setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err: unknown) {
    return interaction.editReply({ embeds: [error(`Failed to fetch hashrate: ${getErrorMessage(err)}`)] });
  }
}


