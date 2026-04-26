import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import {
  signerFromWalletRow, getTreasurySigner, explorerTx, parseCOIN,
  safeEstimateGas, DEAD_ADDRESS, formatCOIN
} from '@chainbot/shared';
import { getWallet, getCooldown, setCooldown } from '../lib/db.js';
import {
  error, warning, formatCooldown,
  fmtCoin, BRAND_FOOTER
} from '../lib/discord.js';

export const data = new SlashCommandBuilder()
  .setName('gamble')
  .setDescription('Bet COIN — 50/50 chance to double or lose it all (burned to 0xdead)')
  .addNumberOption(opt =>
    opt.setName('amount')
       .setDescription('Amount of COIN to bet')
       .setMinValue(0.000001)
       .setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const remaining = await getCooldown(interaction.user.id, 'gamble');
  if (remaining > 0) {
    return interaction.editReply({
      embeds: [warning('Cool Down', `Wait **${formatCooldown(remaining)}** before gambling again.`)],
    });
  }

  const walletRow = await getWallet(interaction.user.id);
  if (!walletRow) return interaction.editReply({ embeds: [error("No wallet found. Use `/wallet create` first.")] });
  if (!walletRow.is_custodial) return interaction.editReply({ embeds: [error('View-only wallets cannot gamble.')] });

  const amount = interaction.options.getNumber('amount', true);
  const betWei = parseCOIN(amount.toString(), 18);

  try {
    const signer = signerFromWalletRow(walletRow);
    const provider = signer.provider;
    if (!provider) throw new Error('Provider not available.');

    const balance = await provider.getBalance(walletRow.address);

    if (balance < betWei) {
      return interaction.editReply({
        embeds: [error(`Insufficient balance. You have **${formatCOIN(balance)} COIN** but bet **${amount} COIN**.`)],
      });
    }

    // Use block hash entropy for randomness (server-side flip)
    const block = await provider.getBlock('latest');
    if (!block) throw new Error('Could not fetch latest block.');

    const seed = ethers.solidityPackedKeccak256(
      ['bytes32', 'address', 'uint256'],
      [block.hash, walletRow.address, block.timestamp]
    );
    const won = BigInt(seed) % 2n === 0n;

    let txHash = '';

    if (won) {
      // Win: send double back from treasury (treasury must have funds)
      const payout = betWei * 2n;
      const tx = await safeEstimateGas(
        getTreasurySigner().sendTransaction({ to: walletRow.address, value: payout })
      );
      const receipt = await tx.wait(1);
      txHash = receipt?.hash ?? tx.hash;
    } else {
      // Lose: burn the bet to 0xdead
      const tx = await safeEstimateGas(
        signer.sendTransaction({ to: DEAD_ADDRESS, value: betWei })
      );
      const receipt = await tx.wait(1);
      txHash = receipt?.hash ?? tx.hash;
    }

    await setCooldown(interaction.user.id, 'gamble');

    const embed = new EmbedBuilder()
      .setColor(won ? 0x57F287 : 0xED4245)
      .setTitle(won ? '🎰 You Won! 🎉' : '🎰 You Lost... 💀')
      .setDescription(
        won
          ? `Lady Luck smiled! You bet **${amount} COIN** and doubled up to **${amount * 2} COIN**!`
          : `The house wins. Your **${amount} COIN** was burned to the void. 🔥`
      )
      .addFields(
        { name: '💰 Bet', value: `${fmtCoin(amount)} COIN`, inline: true },
        { name: won ? '✅ Outcome' : '❌ Outcome', value: won ? 'WIN' : 'LOSE', inline: true },
        { name: '🔗 Tx', value: `[View](${explorerTx(txHash)})`, inline: true },
      )
      .setFooter({ text: BRAND_FOOTER })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    return interaction.editReply({ embeds: [error(err.message ?? 'Gamble failed.')] });
  }
}
