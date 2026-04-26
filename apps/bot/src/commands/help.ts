import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { BRAND_COLOR, BRAND_FOOTER } from '../lib/discord.js';

const SECTIONS = [
  {
    name: '👛 Wallet',
    value: [
      '`/wallet create` — Generate a custodial wallet',
      '`/wallet import` — Link an external address (view-only)',
      '`/balance` — View COIN + token holdings + USD values',
      '`/send` — Send COIN to a @user or address',
    ].join('\n'),
  },
  {
    name: '⛏️ Mining & Daily',
    value: [
      '`/daily` — Claim daily COIN (halves every 30 days)',
      '`/miner download` — MinerCLI downloads + network stats',
      '`/hashrate [@user]` — View miner hashrate & rank',
      '`/leaderboard miners` — Top 10 miners',
    ].join('\n'),
  },
  {
    name: '⚙️ Network',
    value: [
      '`/nodes` — View live protocol infrastructure and status',
      '`/price [$ticker]` — Live price + 24h change',
    ].join('\n'),
  },
  {
    name: '🪙 Tokens & DEX',
    value: [
      '`/token create` — Deploy a new ERC-20 token',
      '`/token info [$ticker]` — Price, market cap, holders',
      '`/swap [from] [to] [amount]` — DEX swap with slippage preview',
      '`/liquidity add` — Add liquidity to a DEX pool',
    ].join('\n'),
  },
  {
    name: '🏦 Stablecoins',
    value: [
      '`/vault open [amount]` — Deposit COIN as collateral',
      '`/vault mint [stablecoin] [amount]` — Mint stablecoins',
      '`/vault repay [amount]` — Repay vault debt',
      '`/vault status` — View vault health & liquidation price',
    ].join('\n'),
  },
  {
    name: '🎮 Economy',
    value: [
      '`/work` — Earn COIN with random jobs (1h cooldown)',
      '`/gamble [amount]` — 50/50 double or burn (1 min cooldown)',
      '`/shop` — Browse NFT & badge shop',
      '`/shop buy:<id>` — Purchase an item',
      '`/inventory [@user]` — View NFTs and badges',
      '`/leaderboard rich` — Top 10 COIN holders',
    ].join('\n'),
  },
];

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show all available ChainBot commands');

export async function execute(interaction: ChatInputCommandInteraction) {
  const embed = new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle('📖 ChainBot — Command Reference')
    .setDescription(
      '**Chain ID:** `13371`  •  **Token:** `COIN`  •  **RPC:** `chainbot.animeos.dev/rpc`\n\n' +
      'Start with `/wallet create` to get your free custodial wallet!'
    )
    .addFields(SECTIONS)
    .setFooter({ text: BRAND_FOOTER })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}
