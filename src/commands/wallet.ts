import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import { encryptPrivateKey } from '../core.js';
import { getWallet, saveWallet, success, error, warning, BRAND_FOOTER } from '../core.js';

export const data = new SlashCommandBuilder().setName('wallet').setDescription('Wallet management')
  .addSubcommand(sub => sub.setName('create').setDescription('New custodial wallet'))
  .addSubcommand(sub => sub.setName('import').setDescription('Import view-only address').addStringOption(o => o.setName('address').setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'create') {
    await interaction.deferReply({ ephemeral: true });
    if (await getWallet(interaction.user.id)) return interaction.editReply({ embeds: [warning('Exists', 'You already have a wallet.')] });
    const w = ethers.Wallet.createRandom(), enc = encryptPrivateKey(w.privateKey);
    await saveWallet(interaction.user.id, w.address.toLowerCase(), enc, true);
    try {
      await interaction.user.send({ embeds: [new EmbedBuilder().setColor(0xED4245).setTitle('🔐 Your Zenith Wallet').addFields({ name: '📬 Address', value: `\`${w.address}\`` }, { name: '🔑 Private Key', value: `\`\`\`${w.privateKey}\`\`\`` }).setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
    } catch { return interaction.editReply({ embeds: [warning('DMs Closed', `Wallet \`${w.address}\` created but couldn't DM key.`)] }); }
    return interaction.editReply({ embeds: [success('Created!', 'Check your DMs for the key.')] });
  }
  if (sub === 'import') {
    await interaction.deferReply({ ephemeral: true });
    const addr = interaction.options.getString('address', true).trim();
    if (!ethers.isAddress(addr)) return interaction.editReply({ embeds: [error('Invalid address.')] });
    await saveWallet(interaction.user.id, addr.toLowerCase(), null, false);
    return interaction.editReply({ embeds: [success('Imported!', `Linked \`${addr}\` (view-only).`)] });
  }
}


