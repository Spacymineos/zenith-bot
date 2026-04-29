import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import { signerFromWalletRow, explorerTx, parseCOIN, formatCOIN, safeEstimateGas, getErrorMessage } from '../core.js';
import { getWallet, getCooldown, setCooldown, success, error, warning, formatCooldown } from '../core.js';

export const data = new SlashCommandBuilder()
  .setName('send').setDescription('Send Zenith Coin')
  .addStringOption(opt => opt.setName('recipient').setDescription('@mention or 0x address').setRequired(true))
  .addNumberOption(opt => opt.setName('amount').setDescription('Amount').setMinValue(0.000001).setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const remaining = await getCooldown(interaction.user.id, 'send');
  if (remaining > 0) return interaction.editReply({ embeds: [warning('Slow down!', `Wait **${formatCooldown(remaining)}**.`)] });

  const senderRow = await getWallet(interaction.user.id);
  if (!senderRow) return interaction.editReply({ embeds: [error("No wallet found.")] });
  if (!senderRow.isCustodial) return interaction.editReply({ embeds: [error('View-only wallet.')] });

  const rawRecipient = interaction.options.getString('recipient', true).trim();
  const amount = interaction.options.getNumber('amount', true);
  let toAddress: string;

  if (ethers.isAddress(rawRecipient)) {
    toAddress = rawRecipient;
  } else {
    const mention = rawRecipient as string;
    const match = mention.match(/^<@!?(\d+)>$/);
    if (!match) return interaction.editReply({ embeds: [error('Invalid recipient.')] });
    const row = await getWallet(match[1]!);
    if (!row) return interaction.editReply({ embeds: [error('User has no wallet.')] });
    toAddress = row.address;
  }

  if (toAddress.toLowerCase() === senderRow.address.toLowerCase()) return interaction.editReply({ embeds: [error('Cannot send to yourself.')] });

  try {
    const signer = signerFromWalletRow(senderRow);
    const value = parseCOIN(amount.toString());
    const provider = signer.provider!;
    if ((await provider.getBalance(senderRow.address)) < value) return interaction.editReply({ embeds: [error(`Insufficient balance.`)] });

    const tx = await safeEstimateGas(signer.sendTransaction({ to: toAddress, value }));
    await tx.wait(1);
    await setCooldown(interaction.user.id, 'send');
    return interaction.editReply({ embeds: [success('Transaction Sent!', `Sent **${amount} Zenith Coin** to \`${toAddress}\`.\n\n[View](${explorerTx(tx.hash)})`)] });
  } catch (err: unknown) { return interaction.editReply({ embeds: [error(getErrorMessage(err) || 'Send failed.')] }); }
}


