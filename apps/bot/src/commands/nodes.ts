import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BRAND_COLOR, BRAND_FOOTER } from '../lib/discord.js';
import { getProvider } from '@chainbot/shared';

export const data = new SlashCommandBuilder()
  .setName('nodes')
  .setDescription('View live protocol infrastructure and node status');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  let latency = 'N/A';
  let peers = 'N/A';
  let blockHeight = 'N/A';

  try {
    const provider = getProvider();
    
    const start = Date.now();
    const block = await provider.getBlockNumber();
    latency = `${Date.now() - start}ms`;
    blockHeight = block.toLocaleString();

    try {
      const peerCount = await provider.send('net_peerCount', []);
      peers = parseInt(peerCount, 16).toString();
    } catch {
      peers = '0';
    }
  } catch (err) {
    console.error('[NODES] RPC error:', err);
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('🌐 Network Infrastructure Status')
    .setDescription('Real-time telemetry from the Zenith sovereign protocol.')
    .addFields(
      {
        name: '📊 Network Health',
        value: [
          `**Latency:** \`${latency}\``,
          `**Connected Peers:** \`${peers}\``,
          `**Block Height:** \`#${blockHeight}\``,
          `**Status:** \`${blockHeight !== 'N/A' ? '🟢 Operational' : '🔴 Degraded'}\``,
        ].join('\n'),
        inline: false,
      },
      {
        name: '📡 Infrastructure',
        value: [
          `**RPC Entry:** \`${process.env.RPC_URL}\``,
          `**Chain ID:** \`13371\``,
        ].join('\n'),
        inline: false,
      },
    )
    .setFooter({ text: BRAND_FOOTER })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}
