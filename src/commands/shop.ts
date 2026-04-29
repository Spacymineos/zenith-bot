import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { contract, signerFromWalletRow, safeEstimateGas, explorerTx, formatCOIN } from '../core.js';
import { getWallet, error, BRAND_COLOR, BRAND_FOOTER, getErrorMessage } from '../core.js';

export const data = new SlashCommandBuilder().setName('shop').setDescription('NFT shop')
  .addIntegerOption(opt => opt.setName('buy').setDescription('Item ID').setMinValue(0));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const buyId = interaction.options.getInteger('buy'), walletRow = await getWallet(interaction.user.id);
  const nft = contract('NFTCollection');

  if (buyId === null) {
    try {
      const [ids, names, prices, stocks] = await nft.getShopItems();
      if (!ids.length) return interaction.editReply({ embeds: [new EmbedBuilder().setColor(BRAND_COLOR).setTitle('🛒 Shop').setDescription('Empty right now.').setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
      const lines = ids.map((id: bigint, i: number) => `**#${Number(id)} — ${names[i]}**\n🪙 ${formatCOIN(prices[i]!)} Zenith Coin  •  ${Number(stocks[i]) === 0 ? '**SOLD OUT**' : `${stocks[i]} left`}`);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(BRAND_COLOR).setTitle('🛒 NFT Shop').setDescription(lines.join('\n\n') + '\n\n> `/shop buy:<id>`').setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
    } catch (err: unknown) { return interaction.editReply({ embeds: [error(`Failed: ${getErrorMessage(err)}`)] }); }
  }

  if (!walletRow) return interaction.editReply({ embeds: [error("Need a wallet. Use `/wallet create`.")] });
  if (!walletRow.isCustodial) return interaction.editReply({ embeds: [error('Need custodial wallet.')] });

  try {
    const [ids, names, prices, stocks] = await nft.getShopItems();
    const idx = ids.findIndex((id: bigint) => Number(id) === buyId);
    if (idx === -1) return interaction.editReply({ embeds: [error(`Item #${buyId} not found.`)] });
    if (Number(stocks[idx]) === 0) return interaction.editReply({ embeds: [error(`**${names[idx]}** sold out!`)] });

    const price = prices[idx]!;
    const signer = signerFromWalletRow(walletRow);
    if ((await signer.provider!.getBalance(walletRow.address)) < price) return interaction.editReply({ embeds: [error(`Insufficient balance.`)] });

    const tx = await safeEstimateGas(contract('NFTCollection', signer).purchase(BigInt(buyId), { value: price }));
    const receipt = await tx.wait(1);
    return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('🛍️ Purchase Success!').setDescription(`You bought **${names[idx]}**!`).addFields({ name: '🔗 Tx', value: `[View](${explorerTx(receipt!.hash)})` }).setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
  } catch (err: unknown) { return interaction.editReply({ embeds: [error(`Failed: ${getErrorMessage(err)}`)] }); }
}


