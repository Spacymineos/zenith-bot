import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { contract, formatCOIN } from '../core.js';
import { BRAND_COLOR, BRAND_FOOTER, ENV } from '../core.js';

const DOWNLOAD_LINKS = {
  windows: '#',
  mac: '#',
  linux: '#',
};

export const data = new SlashCommandBuilder().setName('validator').setDescription('Validation commands')
  .addSubcommand(sub => sub.setName('stats').setDescription('Validator stats + links'));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  let totalPower = 'N/A', blockReward = 'N/A';
  try {
    const registry = contract('MinerRegistry');
    const [rawPower, rawReward] = await Promise.all([registry.getTotalHashrate(), registry.getBlockReward()]);
    totalPower = `${Number(rawPower).toLocaleString()} VP`;
    blockReward = `${formatCOIN(rawReward)} Zenith Coin`;
  } catch {}

  const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle('🛡️ Zenith Validator')
    .setDescription('Secure the Zenith network and earn rewards. Download the node software to participate!')
    .addFields(
      { name: '🖥️ Windows', value: `[Download](${DOWNLOAD_LINKS.windows})`, inline: true },
      { name: '🍎 macOS', value: `[Download](${DOWNLOAD_LINKS.mac})`, inline: true },
      { name: '🐧 Linux', value: `[Download](${DOWNLOAD_LINKS.linux})`, inline: true },
      { name: '📡 Network Stats', value: `**Total Power:** ${totalPower}\n**Reward:** ${blockReward}\n**RPC:** \`${ENV.RPC_URL}\`\n**Chain:** \`${ENV.CHAIN_ID}\``, inline: false },
    ).setFooter({ text: BRAND_FOOTER }).setTimestamp();
  return interaction.editReply({ embeds: [embed] });
}


