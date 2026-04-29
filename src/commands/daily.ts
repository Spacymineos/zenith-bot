import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import { contract, signerFromWalletRow, safeEstimateGas, explorerTx } from '../core.js';
import { getWallet, getCooldown, setCooldown, error, warning, fmtCoin, fmtUSD, formatCooldown, BRAND_COLOR, BRAND_FOOTER, getErrorMessage } from '../core.js';

const EPOCH_START = new Date('2024-01-01T00:00:00Z').getTime();
const HALVING_DAYS = 30;
const BASE_REWARD = 100;

function currentDailyReward() {
  const periods = Math.floor((Date.now() - EPOCH_START) / (1000 * 60 * 60 * 24 * HALVING_DAYS));
  return BASE_REWARD / Math.pow(2, periods);
}

export const data = new SlashCommandBuilder().setName('daily').setDescription('Claim your daily Zenith Coin reward (halves every 30 days)');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const remaining = await getCooldown(interaction.user.id, 'daily');
  if (remaining > 0) return interaction.editReply({ embeds: [warning('Come Back Later', `You already claimed today!\n\n⏳ Next claim in **${formatCooldown(remaining)}**.`)] });

  const walletRow = await getWallet(interaction.user.id);
  if (!walletRow) return interaction.editReply({ embeds: [error("No wallet found. Use `/wallet create` first.")] });
  if (!walletRow.isCustodial) return interaction.editReply({ embeds: [error('Daily claims require a custodial wallet.')] });

  const reward = currentDailyReward();
  try {
    const mintCtrl = contract('MintController', signerFromWalletRow(walletRow));
    const tx = await safeEstimateGas(mintCtrl.claimDaily(walletRow.address));
    const receipt = await tx.wait(1);
    if (!receipt) throw new Error('Tx failed');

    let coinPrice = 0;
    try {
      const rawPrice = await contract('PriceOracle').getNativePrice();
      coinPrice = parseFloat(ethers.formatUnits(rawPrice, 8));
    } catch {}

    await setCooldown(interaction.user.id, 'daily');
    const elapsedDays = (Date.now() - EPOCH_START) / (1000 * 60 * 60 * 24);
    const periods = Math.floor(elapsedDays / HALVING_DAYS);
    const nextHalving = ((periods + 1) * HALVING_DAYS) - elapsedDays;

    const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle('🎁 Daily Reward Claimed!')
      .setDescription(`You received **🪙 ${fmtCoin(reward)} Zenith Coin**!`)
      .addFields(
        { name: '💵 Zenith Coin Price', value: fmtUSD(coinPrice), inline: true },
        { name: '💰 Reward Value', value: fmtUSD(reward * coinPrice), inline: true },
        { name: '⏰ Next Halving', value: `~${Math.ceil(nextHalving)} days`, inline: true },
        { name: '🔗 Transaction', value: `[View](${explorerTx(receipt.hash)})`, inline: false },
      ).setFooter({ text: BRAND_FOOTER }).setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err: unknown) {
    return interaction.editReply({ embeds: [error(getErrorMessage(err) || 'Failed to claim daily reward.')] });
  }
}


