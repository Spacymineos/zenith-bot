import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import {
  contract, signerFromWalletRow, safeEstimateGas, explorerTx
} from '@chainbot/shared';
import { getWallet, getCooldown, setCooldown, logJob } from '../lib/db.js';
import {
  error, warning, formatCooldown,
  fmtCoin, BRAND_COLOR, BRAND_FOOTER
} from '../lib/discord.js';

const JOBS = [
  { title: 'You coded for 2 hours straight',       baseReward: 42 },
  { title: 'You drove a Uber for the evening',      baseReward: 35 },
  { title: 'You designed a logo for a client',      baseReward: 55 },
  { title: 'You fixed a neighbor\'s PC',             baseReward: 28 },
  { title: 'You wrote smart contract documentation', baseReward: 48 },
  { title: 'You ran a Discord server for 3 hours',  baseReward: 30 },
  { title: 'You audited a DeFi protocol',           baseReward: 75 },
  { title: 'You traded NFTs successfully',          baseReward: 60 },
  { title: 'You DJ\'d a crypto party',              baseReward: 40 },
  { title: 'You delivered food on your bike',       baseReward: 25 },
  { title: 'You streamed gameplay for 4 hours',     baseReward: 50 },
  { title: 'You grew a vegetable garden patch',     baseReward: 20 },
  { title: 'You wrote a blog post about Web3',      baseReward: 38 },
  { title: 'You tutored a student in mathematics',  baseReward: 45 },
  { title: 'You mined COIN all night',              baseReward: 65 },
];

export const data = new SlashCommandBuilder()
  .setName('work')
  .setDescription('Do some work and earn COIN (1 hour cooldown)');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  // ── Cooldown ───────────────────────────────────────────────────────────────
  const remaining = await getCooldown(interaction.user.id, 'work');
  if (remaining > 0) {
    return interaction.editReply({
      embeds: [warning('Still Working!', `You're still on shift. Back in **${formatCooldown(remaining)}**.`)],
    });
  }

  // ── Wallet check ───────────────────────────────────────────────────────────
  const walletRow = await getWallet(interaction.user.id);
  if (!walletRow) {
    return interaction.editReply({ embeds: [error("You need a wallet first. Use `/wallet create`.")] });
  }
  if (!walletRow.is_custodial) {
    return interaction.editReply({ embeds: [error('Work rewards require a custodial wallet.')] });
  }

  // ── Pick random job + fuzz reward ±20% ────────────────────────────────────
  const job = JOBS[Math.floor(Math.random() * JOBS.length)];
  if (!job) throw new Error('Failed to assign a job.');

  const fuzz = 0.8 + Math.random() * 0.4;
  const reward = Math.round(job.baseReward * fuzz * 100) / 100;

  // ── On-chain mint ──────────────────────────────────────────────────────────
  try {
    const mintCtrl = contract('MintController', signerFromWalletRow(walletRow));
    const rewardWei = ethers.parseUnits(String(reward), 18);
    const tx = await safeEstimateGas((mintCtrl as any).mintReward(walletRow.address, rewardWei));
    const receipt = await tx.wait(1);

    if (!receipt) throw new Error('Transaction failed to confirm.');

    await setCooldown(interaction.user.id, 'work');
    await logJob(interaction.user.id, job.title, reward, receipt.hash);

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('💼 Work Complete!')
      .setDescription(`**${job.title}** — and earned **🪙 ${fmtCoin(reward)} COIN**!`)
      .addFields(
        { name: '⏰ Next Work', value: 'In 1 hour', inline: true },
        { name: '🔗 Reward Tx', value: `[View](${explorerTx(receipt.hash)})`, inline: true },
      )
      .setThumbnail(interaction.user.displayAvatarURL())
      .setFooter({ text: BRAND_FOOTER })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    return interaction.editReply({ embeds: [error(err.message ?? 'Work failed. Try again later.')] });
  }
}
