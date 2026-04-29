import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { contract, signerFromWalletRow, safeEstimateGas, explorerTx, parseCOIN, formatCOIN } from '../core.js';
import { getWallet, error, BRAND_COLOR, BRAND_FOOTER, getErrorMessage } from '../core.js';

export const data = new SlashCommandBuilder().setName('vault').setDescription('Manage your debt vault')
  .addSubcommand(sub => sub.setName('open').setDescription('Deposit Zenith Coin collateral').addNumberOption(o => o.setName('amount').setMinValue(0.000001).setRequired(true)))
  .addSubcommand(sub => sub.setName('mint').setDescription('Mint stablecoins').addStringOption(o => o.setName('stablecoin').setRequired(true)).addNumberOption(o => o.setName('amount').setMinValue(0.000001).setRequired(true)))
  .addSubcommand(sub => sub.setName('repay').setDescription('Repay debt').addNumberOption(o => o.setName('amount').setMinValue(0.000001).setRequired(true)))
  .addSubcommand(sub => sub.setName('status').setDescription('View vault health'));

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();
  const sub = interaction.options.getSubcommand(), walletRow = await getWallet(interaction.user.id);
  if (!walletRow) return interaction.editReply({ embeds: [error("No wallet found.")] });
  if (!walletRow.isCustodial && sub !== 'status') return interaction.editReply({ embeds: [error('View-only wallet.')] });

  const vault = sub === 'status' ? contract('VaultManager') : contract('VaultManager', signerFromWalletRow(walletRow));

  try {
    if (sub === 'open') {
      const val = parseCOIN(interaction.options.getNumber('amount', true).toString());
      const tx = await safeEstimateGas(vault.deposit(val, { value: val })), receipt = await tx.wait(1);
      const s = await vault.getVaultStatus(walletRow.address);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(BRAND_COLOR).setTitle('🏦 Vault Updated').addFields({ name: '🔒 Collateral', value: `${formatCOIN(s.collateral)} Zenith Coin`, inline: true }, { name: '📊 Ratio', value: `${(Number(s.ratio) / 100).toFixed(2)}%`, inline: true }, { name: '🔗 Tx', value: `[View](${explorerTx(receipt!.hash)})` }).setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
    }
    if (sub === 'status') {
      const s = await vault.getVaultStatus(walletRow.address);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(BRAND_COLOR).setTitle('🏦 Vault Status').addFields({ name: '🔒 Collateral', value: `${formatCOIN(s.collateral)} Zenith Coin`, inline: true }, { name: '💸 Debt', value: `${formatCOIN(s.debt)} USDX`, inline: true }, { name: '📊 Ratio', value: `${(Number(s.ratio) / 100).toFixed(2)}%`, inline: true }).setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
    }
    return interaction.editReply({ embeds: [error("Subcommand not implemented.")] });
  } catch (err: unknown) { return interaction.editReply({ embeds: [error(getErrorMessage(err) || 'Vault action failed.')] }); }
}


