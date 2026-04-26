import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import {
  contract, signerFromWalletRow, safeEstimateGas,
  explorerTx, formatCOIN
} from '@chainbot/shared';
import { getWallet } from '../lib/db.js';
import { error, BRAND_COLOR, BRAND_FOOTER } from '../lib/discord.js';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('Browse the NFT shop — buy badges and collectibles with COIN')
  .addIntegerOption(opt =>
    opt.setName('buy')
       .setDescription('Item ID to purchase (shown in shop listing)')
       .setMinValue(0)
       .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const buyId = interaction.options.getInteger('buy');
  const walletRow = await getWallet(interaction.user.id);

  // ── LIST SHOP ───────────────────────────────────────────────────────────────
  if (buyId === null) {
    try {
      const nft = contract('NFTCollection');
      const [ids, names, prices, stocks] = await (nft as any).getShopItems();

      if (!ids.length) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND_COLOR)
              .setTitle('🛒 ChainBot Shop')
              .setDescription('The shop is empty right now. Check back later!')
              .setFooter({ text: BRAND_FOOTER })
              .setTimestamp(),
          ],
        });
      }

      const lines = ids.map((id: bigint, i: number) => {
        const stock = Number(stocks[i]);
        const price = formatCOIN(prices[i]);
        const stockStr = stock === 0 ? '**SOLD OUT**' : `${stock} left`;
        return `**#${Number(id)} — ${names[i]}**\n🪙 ${price} COIN  •  📦 ${stockStr}`;
      });

      const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('🛒 ChainBot NFT Shop')
        .setDescription(
          lines.join('\n\n') + '\n\n> To buy, run `/shop buy:<item_id>`'
        )
        .setFooter({ text: BRAND_FOOTER })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      return interaction.editReply({ embeds: [error(`Failed to fetch shop: ${err.message}`)] });
    }
  }

  // ── BUY ITEM ────────────────────────────────────────────────────────────────
  if (!walletRow) {
    return interaction.editReply({ embeds: [error("You need a wallet to buy. Use `/wallet create` first.")] });
  }
  if (!walletRow.is_custodial) {
    return interaction.editReply({ embeds: [error('View-only wallets cannot make purchases.')] });
  }

  try {
    const nft = contract('NFTCollection');
    const [ids, names, prices, stocks] = await (nft as any).getShopItems();
    const itemIdx = ids.findIndex((id: bigint) => Number(id) === buyId);

    if (itemIdx === -1) {
      return interaction.editReply({ embeds: [error(`Item #${buyId} not found in the shop.`)] });
    }
    if (Number(stocks[itemIdx]) === 0) {
      return interaction.editReply({ embeds: [error(`**${names[itemIdx]}** is sold out!`)] });
    }

    const price = prices[itemIdx];
    const signer = signerFromWalletRow(walletRow);
    const provider = signer.provider;
    if (!provider) throw new Error('Provider not available.');

    const bal = await provider.getBalance(walletRow.address);
    if (bal < price) {
      return interaction.editReply({
        embeds: [error(
          `Insufficient balance. **${names[itemIdx]}** costs ${formatCOIN(price)} COIN. You have ${formatCOIN(bal)} COIN.`
        )],
      });
    }

    const nftSigner = contract('NFTCollection', signer);
    const tx = await safeEstimateGas((nftSigner as any).purchase(BigInt(buyId), { value: price }));
    const receipt = await tx.wait(1);

    if (!receipt) throw new Error('Transaction failed to confirm.');

    const embed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🎉 Purchase Successful!')
      .setDescription(`You bought **${names[itemIdx]}** for **${formatCOIN(price)} COIN**!`)
      .addFields(
        { name: '🔗 Transaction', value: `[View on Explorer](${explorerTx(receipt.hash)})`, inline: false },
      )
      .setFooter({ text: BRAND_FOOTER })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    return interaction.editReply({ embeds: [error(err.message ?? 'Purchase failed.')] });
  }
}
