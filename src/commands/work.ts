import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import { contract, signerFromWalletRow, safeEstimateGas, explorerTx } from '../core.js';
import { getWallet, getCooldown, setCooldown, error, warning, formatCooldown, fmtCoin, BRAND_COLOR, BRAND_FOOTER, getErrorMessage } from '../core.js';

const JOBS = [
  { title: 'You coded for 2 hours straight', baseReward: 42 },
  { title: 'You fixed a neighbor\'s PC', baseReward: 28 },
  { title: 'You audited a DeFi protocol', baseReward: 75 },
  { title: 'You mined Zenith Coin all night', baseReward: 65 },
];

export const data = new SlashCommandBuilder().setName('work').setDescription('Earn Zenith Coin');

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const remaining = await getCooldown(interaction.user.id, 'work');
  if (remaining > 0) return interaction.editReply({ embeds: [warning('Working!', `Wait **${formatCooldown(remaining)}**.`)] });

  const walletRow = await getWallet(interaction.user.id);
  if (!walletRow?.isCustodial) return interaction.editReply({ embeds: [error('Need custodial wallet.')] });

  const job = JOBS[Math.floor(Math.random() * JOBS.length)]!;
  const reward = Math.round(job.baseReward * (0.8 + Math.random() * 0.4) * 100) / 100;

  try {
    const mintCtrl = contract('MintController', signerFromWalletRow(walletRow)), rewardWei = ethers.parseUnits(String(reward), 18);
    const tx = await safeEstimateGas(mintCtrl.mintWork(walletRow.address, rewardWei)), receipt = await tx.wait(1);
    await setCooldown(interaction.user.id, 'work');
    return interaction.editReply({ embeds: [new EmbedBuilder().setColor(BRAND_COLOR).setTitle('💼 Work Done!').setDescription(`**${job.title}** — earned **🪙 ${fmtCoin(reward)} Zenith Coin**!`).addFields({ name: '🔗 Tx', value: `[View](${explorerTx(receipt!.hash)})` }).setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
  } catch (err: unknown) { return interaction.editReply({ embeds: [error(getErrorMessage(err) || 'Work failed.')] }); }
}


