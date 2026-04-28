import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { contract, formatCOIN } from '@chainbot/shared';
import { BRAND_COLOR, BRAND_FOOTER, HASH_EMOJI } from '../lib/discord.js';

// Update these URLs when MinerCLI builds are available
const DOWNLOAD_LINKS = {
  windows: 'https://zenith.animeos.dev/downloads/minercli-windows-amd64.zip',
  mac:     'https://zenith.animeos.dev/downloads/minercli-darwin-amd64.tar.gz',
  linux:   'https://zenith.animeos.dev/downloads/minercli-linux-amd64.tar.gz',
};

export const data = new SlashCommandBuilder()
  .setName('miner')
  .setDescription('Mining-related commands')
  .addSubcommand(sub =>
    sub.setName('download')
       .setDescription('Get the MinerCLI download links + live network stats')
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  let totalHashrate = 'N/A';
  let blockReward   = 'N/A';

  try {
    const registry = contract('MinerRegistry');
    const [rawHash, rawReward] = await Promise.all([
      (registry as any).getTotalHashrate(),
      (registry as any).getBlockReward(),
    ]);
    totalHashrate = `${Number(rawHash).toLocaleString()} H/s`;
    blockReward   = `${formatCOIN(rawReward)} COIN`;
  } catch { /* RPC issue — continue with N/A */ }

  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(`${HASH_EMOJI} Zenith MinerCLI`)
    .setDescription(
      'Mine COIN on the Zenith network. Download the CLI for your OS and start earning block rewards!'
    )
    .addFields(
      {
        name: '🖥️ Windows',
        value: `[Download .zip](${DOWNLOAD_LINKS.windows})`,
        inline: true,
      },
      {
        name: '🍎 macOS',
        value: `[Download .tar.gz](${DOWNLOAD_LINKS.mac})`,
        inline: true,
      },
      {
        name: '🐧 Linux',
        value: `[Download .tar.gz](${DOWNLOAD_LINKS.linux})`,
        inline: true,
      },
      {
        name: '📡 Network Stats',
        value: [
          `**Total Hashrate:** ${totalHashrate}`,
          `**Block Reward:** ${blockReward}`,
          `**RPC:** \`${process.env.RPC_URL}\``,
          `**Chain ID:** \`13371\``,
        ].join('\n'),
        inline: false,
      },
      {
        name: '🚀 Quick Start',
        value: [
          '```bash',
          '# Linux/Mac',
          'chmod +x minercli && ./minercli mine \\',
          '  --rpc https://zenith.animeos.dev/rpc \\',
          '  --wallet YOUR_ADDRESS',
          '```',
        ].join('\n'),
        inline: false,
      }
    )
    .setFooter({ text: BRAND_FOOTER })
    .setTimestamp();

  return interaction.editReply({ embeds: [embed] });
}
