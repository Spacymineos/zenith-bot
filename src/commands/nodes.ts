import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BRAND_COLOR, BRAND_FOOTER, ENV } from '../core.js';
import { getProvider } from '../core.js';

export const data = new SlashCommandBuilder().setName('nodes').setDescription('View infrastructure status');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  let latency = 'N/A', peers = 'N/A', blockHeight = 'N/A';
  try {
    const provider = getProvider();
    const start = Date.now();
    blockHeight = (await provider.getBlockNumber()).toLocaleString();
    latency = `${Date.now() - start}ms`;
    try { peers = parseInt(await provider.send('net_peerCount', []), 16).toString(); } catch { peers = '0'; }
  } catch (err) { console.error('[NODES] RPC error:', err); }

  const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle('🌐 Network Status')
    .setDescription('Real-time telemetry from Zenith protocol.')
    .addFields(
      { name: '📊 Health', value: `**Latency:** \`${latency}\`\n**Peers:** \`${peers}\`\n**Height:** \`#${blockHeight}\`\n**Status:** \`${blockHeight !== 'N/A' ? '🟢 Operational' : '🔴 Degraded'}\``, inline: false },
      { name: '📡 Infra', value: `**RPC:** \`${ENV.RPC_URL}\`\n**Chain:** \`${ENV.CHAIN_ID}\``, inline: false },
    ).setFooter({ text: BRAND_FOOTER }).setTimestamp();
  return interaction.editReply({ embeds: [embed] });
}


