import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import { signerFromWalletRow, getTreasurySigner, explorerTx, parseCOIN, safeEstimateGas, DEAD_ADDRESS, formatCOIN, getErrorMessage } from '../core.js';
import { getWallet, getCooldown, setCooldown, error, warning, formatCooldown, fmtCoin, BRAND_FOOTER } from '../core.js';

async function rollGambleOutcome(address: string, provider: NonNullable<ReturnType<typeof signerFromWalletRow>["provider"]>): Promise<boolean> {
  const block = await provider.getBlock('latest');
  if (!block) throw new Error('Could not fetch latest block.');
  const seed = ethers.solidityPackedKeccak256(['bytes32', 'address', 'uint256'], [block.hash, address, block.timestamp]);
  return BigInt(seed) % 2n === 0n;
}

async function settleGamble(address: string, signer: ReturnType<typeof signerFromWalletRow>, betWei: bigint, won: boolean): Promise<string> {
  const tx = won
    ? await safeEstimateGas(getTreasurySigner().sendTransaction({ to: address, value: betWei * 2n }))
    : await safeEstimateGas(signer.sendTransaction({ to: DEAD_ADDRESS, value: betWei }));
  const receipt = await tx.wait(1);
  return receipt?.hash ?? tx.hash;
}

function buildResultEmbed(amount: number, won: boolean, txHash: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(won ? 0x57F287 : 0xED4245)
    .setTitle(won ? '🎰 You Won! 🎉' : '🎰 You Lost... 💀')
    .setDescription(won ? `Luck smiled! You bet **${amount} Zenith Coin** and doubled up!` : `House wins. Your **${amount} Zenith Coin** was burned. 🔥`)
    .addFields(
      { name: '💰 Bet', value: `${fmtCoin(amount)} Zenith Coin`, inline: true },
      { name: won ? '✅ Outcome' : '❌ Outcome', value: won ? 'WIN' : 'LOSE', inline: true },
      { name: '🔗 Tx', value: `[View](${explorerTx(txHash)})`, inline: true },
    ).setFooter({ text: BRAND_FOOTER }).setTimestamp();
}

export const data = new SlashCommandBuilder().setName('gamble').setDescription('Bet Zenith Coin — 50/50 double or lose')
  .addNumberOption(opt => opt.setName('amount').setDescription('Amount to bet').setMinValue(0.000001).setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const remaining = await getCooldown(interaction.user.id, 'gamble');
  if (remaining > 0) return interaction.editReply({ embeds: [warning('Cool Down', `Wait **${formatCooldown(remaining)}**.`)] });

  const walletRow = await getWallet(interaction.user.id);
  if (!walletRow) return interaction.editReply({ embeds: [error("No wallet found.")] });
  if (!walletRow.isCustodial) return interaction.editReply({ embeds: [error('View-only wallets cannot gamble.')] });

  const amount = interaction.options.getNumber('amount', true);
  const betWei = parseCOIN(amount.toString(), 18);

  try {
    const signer = signerFromWalletRow(walletRow);
    const provider = signer.provider;
    if (!provider) throw new Error('No provider');
    if ((await provider.getBalance(walletRow.address)) < betWei) return interaction.editReply({ embeds: [error(`Insufficient balance.`)] });

    const won = await rollGambleOutcome(walletRow.address, provider);
    const txHash = await settleGamble(walletRow.address, signer, betWei, won);
    await setCooldown(interaction.user.id, 'gamble');
    return interaction.editReply({ embeds: [buildResultEmbed(amount, won, txHash)] });
  } catch (err) {
    return interaction.editReply({ embeds: [error(getErrorMessage(err) || 'Gamble failed.')] });
  }
}


