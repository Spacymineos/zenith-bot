import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { contract } from '../core.js';
import { getWallet, error, BRAND_COLOR, BRAND_FOOTER, getErrorMessage } from '../core.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription("View a user's NFT collection and badges")
  .addUserOption(opt => opt.setName('user').setDescription('User to check (defaults to you)'));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const targetUser = interaction.options.getUser('user') ?? interaction.user;
  const walletRow = await getWallet(targetUser.id);

  if (!walletRow) {
    const isOwn = targetUser.id === interaction.user.id;
    return interaction.editReply({ embeds: [error(isOwn ? "No wallet found." : `${targetUser.displayName} has no wallet.`)] });
  }

  try {
    const nft = contract('NFTCollection');
    const balance = await nft.balanceOf(walletRow.address);
    const count = Number(balance);

    if (count === 0) {
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(BRAND_COLOR).setTitle(`🎒 ${targetUser.displayName}'s Inventory`).setDescription('No NFTs yet. Visit `/shop`!').setThumbnail(targetUser.displayAvatarURL()).setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
    }

    const limit = Math.min(count, 25);
    const tokenIds = await Promise.all(Array.from({ length: limit }, (_, i) => nft.tokenOfOwnerByIndex(walletRow.address, i)));
    const names = await Promise.all(tokenIds.map(id => nft.getItemName(id).catch(() => `Token #${id}`)));
    const lines = tokenIds.map((id, i) => `🃏 **#${Number(id)}** — ${names[i]}`);
    if (count > 25) lines.push(`\n*...and ${count - 25} more items*`);

    const embed = new EmbedBuilder().setColor(BRAND_COLOR).setTitle(`🎒 ${targetUser.displayName}'s Inventory`)
      .setDescription(lines.join('\n')).setThumbnail(targetUser.displayAvatarURL())
      .addFields({ name: '🏦 Total NFTs', value: `${count}`, inline: true }, { name: '📬 Wallet', value: `\`${walletRow.address}\``, inline: false })
      .setFooter({ text: BRAND_FOOTER }).setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err: unknown) {
    return interaction.editReply({ embeds: [error(`Failed to fetch inventory: ${getErrorMessage(err)}`)] });
  }
}


