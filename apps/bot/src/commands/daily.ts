import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import {
  contract, signerFromWalletRow, safeEstimateGas,
  explorerTx
} from '@chainbot/shared';
import { getWallet, getCooldown, setCooldown } from '../lib/db.js';
import {
  error, warning,
  fmtCoin, fmtUSD, formatCooldown,
  BRAND_COLOR, BRAND_FOOTER
} from '../lib/discord.js';

// Bot epoch start — used to compute the halving schedule
const EPOCH_START = new Date('2024-01-01T00:00:00Z').getTime();
const HALVING_DAYS = 30;
const BASE_REWARD = 100; // COIN

/** Returns the current daily reward based on elapsed 30-day periods */
function currentDailyReward() {
  const elapsed = Date.now() - EPOCH_START;
  const elapsedDays = elapsed / (1000 * 60 * 60 * 24);
  const periods = Math.floor(elapsedDays / HALVING_DAYS);
  return BASE_REWARD / Math.pow(2, periods);
}

export const data = new SlashCommandBuilder()
  .setName('daily')
  .setDescription('Claim your daily COIN reward (halves every 30 days)');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  // ── Cooldown check ─────────────────────────────────────────────────────────
  const remaining = await getCooldown(interaction.user.id, 'daily');
  if (remaining > 0) {
    const embed = warning('Come Back Later',
      `You already claimed today!\n\n⏳ Next claim in **${formatCooldown(remaining)}**.`
    );
    return interaction.editReply({ embeds: [embed] });
  }

  // ── Wallet check ───────────────────────────────────────────────────────────
  const walletRow = await getWallet(interaction.user.id);
  if (!walletRow) {
    return interaction.editReply({
      embeds: [error("You don't have a wallet yet. Use `/wallet create` first.")],
    });
  }
  if (!walletRow.is_custodial) {
    return interaction.editReply({
      embeds: [error('Daily claims require a custodial wallet. Use `/wallet create` to get one.')],
    });
  }

  // ── Compute reward ─────────────────────────────────────────────────────────
  const reward = currentDailyReward();

  // ── Call on-chain mint ─────────────────────────────────────────────────────
  try {
    const mintCtrl = contract('MintController', signerFromWalletRow(walletRow));
    const tx = await safeEstimateGas(
      (mintCtrl as any).claimDaily(walletRow.address)
    );
    const receipt = await tx.wait(1);

    if (!receipt) throw new Error('Transaction failed to confirm.');

    // Fetch COIN price for embed
    let coinPrice = 0;
    try {
      const rawPrice = await (contract('PriceOracle') as any).getNativePrice();
      coinPrice = parseFloat(ethers.formatUnits(rawPrice, 8));
    } catch { /* oracle unavailable */ }

    await setCooldown(interaction.user.id, 'daily');

    const elapsedDays = (Date.now() - EPOCH_START) / (1000 * 60 * 60 * 24);
    const periods = Math.floor(elapsedDays / HALVING_DAYS);
    const nextHalving = ((periods + 1) * HALVING_DAYS) - elapsedDays;

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🎁 Daily Reward Claimed!')
      .setDescription(`You received **🪙 ${fmtCoin(reward)} COIN**!`)
      .addFields(
        { name: '💵 COIN Price', value: fmtUSD(coinPrice), inline: true },
        { name: '💰 Reward Value', value: fmtUSD(reward * coinPrice), inline: true },
        { name: '⏰ Next Halving', value: `~${Math.ceil(nextHalving)} days`, inline: true },
        { name: '🔗 Transaction', value: `[View on Explorer](${explorerTx(receipt.hash)})`, inline: false },
      )
      .setFooter({ text: BRAND_FOOTER })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    return interaction.editReply({
      embeds: [error(err.message ?? 'Failed to claim daily reward. Please try again.')],
    });
  }
}
