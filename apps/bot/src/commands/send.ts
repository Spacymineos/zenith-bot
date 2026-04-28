import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import {
  signerFromWalletRow, explorerTx, parseCOIN, formatCOIN, safeEstimateGas
} from '@chainbot/shared';
import { getWallet, getCooldown, setCooldown } from '../lib/db.js';
import { success, error, warning, formatCooldown, shortAddr } from '../lib/discord.js';

export const data = new SlashCommandBuilder()
  .setName('send')
  .setDescription('Send COIN to a Discord user or an address')
  .addStringOption(opt =>
    opt.setName('recipient')
       .setDescription('@mention or 0x address')
       .setRequired(true)
  )
  .addNumberOption(opt =>
    opt.setName('amount')
       .setDescription('Amount of COIN to send')
       .setMinValue(0.000001)
       .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  // ── Anti-spam cooldown (10s) ───────────────────────────────────────────────
  const remaining = await getCooldown(interaction.user.id, 'send');
  if (remaining > 0) {
    return interaction.editReply({
      embeds: [warning('Slow down!', `Please wait **${formatCooldown(remaining)}** before sending again.`)],
    });
  }

  // ── Validate sender wallet ─────────────────────────────────────────────────
  const senderRow = await getWallet(interaction.user.id);
  if (!senderRow) {
    return interaction.editReply({
      embeds: [error("You don't have a wallet yet. Use `/wallet create` first.")],
    });
  }
  if (!senderRow.is_custodial) {
    return interaction.editReply({
      embeds: [error('Your wallet is view-only (imported). You cannot send transactions through the bot.')],
    });
  }

  // ── Resolve recipient ──────────────────────────────────────────────────────
  const rawRecipient = interaction.options.getString('recipient', true).trim();
  const amount = interaction.options.getNumber('amount', true);
  let toAddress: string;

  // Check if it's a valid 0x address
  if (ethers.isAddress(rawRecipient)) {
    toAddress = rawRecipient;
  } else {
    // Try to parse a Discord mention <@123456>
    const mentionMatch = (rawRecipient as any).match(/^<@!?(\d+)>$/);
    if (!mentionMatch) {
      return interaction.editReply({
        embeds: [error('Invalid recipient. Provide a @mention or a valid `0x` address.')],
      });
    }
    const recipientRow = await getWallet(mentionMatch[1]);
    if (!recipientRow) {
      return interaction.editReply({
        embeds: [error('That user does not have a Zenith wallet yet.')],
      });
    }
    toAddress = recipientRow.address;
  }

  if (toAddress.toLowerCase() === senderRow.address.toLowerCase()) {
    return interaction.editReply({
      embeds: [error('You cannot send COIN to yourself.')],
    });
  }

  // ── Execute transaction ────────────────────────────────────────────────────
  try {
    const signer = signerFromWalletRow(senderRow);
    const value = parseCOIN(amount.toString());
    const provider = signer.provider;
    if (!provider) throw new Error('Provider not available.');

    const balance = await provider.getBalance(senderRow.address);

    if (balance < value) {
      return interaction.editReply({
        embeds: [error(`Insufficient balance. You have **${formatCOIN(balance)} COIN** but tried to send **${amount} COIN**.`)],
      });
    }

    const tx = await safeEstimateGas(
      signer.sendTransaction({ to: toAddress, value })
    );

    await tx.wait(1);
    await setCooldown(interaction.user.id, 'send');

    return interaction.editReply({
      embeds: [
        success('Transfer Sent!',
          [
            `**From:** \`${shortAddr(senderRow.address)}\``,
            `**To:** \`${shortAddr(toAddress)}\``,
            `**Amount:** 🪙 ${amount} COIN`,
            `**Tx:** [View on Explorer](${explorerTx(tx.hash)})`,
          ].join('\n')
        ),
      ],
    });
  } catch (err: any) {
    return interaction.editReply({
      embeds: [error(err.message ?? 'Transaction failed. Please try again.')],
    });
  }
}
