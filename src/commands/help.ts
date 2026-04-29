import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BRAND_COLOR, BRAND_FOOTER, ENV } from '../core.js';

const SECTIONS = [
  { name: '👛 Wallet', value: '`/wallet create`, `/wallet import`, `/balance`, `/send`' },
  { name: '⛏️ Mining & Daily', value: '`/daily`, `/miner download`, `/hashrate`, `/leaderboard miners`' },
  { name: '⚙️ Network', value: '`/nodes`, `/price`' },
  { name: '🪙 Tokens & DEX', value: '`/token create`, `/token info`, `/swap`, `/liquidity add`' },
  { name: '🏦 Stablecoins', value: '`/vault open`, `/vault mint`, `/vault repay`, `/vault status`' },
  { name: '🎮 Economy', value: '`/work`, `/gamble`, `/shop`, `/inventory`, `/leaderboard rich`' },
];

export const data = new SlashCommandBuilder().setName('help').setDescription('Show all available Zenith commands');

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('📖 Zenith — Command Reference')
    .setDescription(`**Chain ID:** \`${ENV.CHAIN_ID}\`  •  **Token:** \`Zenith Coin\`  •  **RPC:** \`${ENV.RPC_URL}\`\\n\\nStart with \`/wallet create\` to get started!`)
    .addFields(SECTIONS)
    .setFooter({ text: BRAND_FOOTER })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}


