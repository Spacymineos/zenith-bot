import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from 'discord.js';
import { pool, getTokenBySymbol } from '../lib/db.js';
import { success, error, BRAND_COLOR, BRAND_FOOTER } from '../lib/discord.js';
import { v4 as uuidv4 } from 'uuid';

export const data = new SlashCommandBuilder()
  .setName('pay')
  .setDescription('Create a payment link for crypto transfers')
  .addSubcommand(sub =>
    sub.setName('create')
       .setDescription('Generate a new payment invoice link')
       .addNumberOption(opt =>
         opt.setName('amount')
            .setDescription('Amount to request')
            .setMinValue(0.0001)
            .setRequired(true)
       )
       .addStringOption(opt =>
         opt.setName('token')
            .setDescription('Token symbol (e.g. COIN, USD, EUR) - Default is COIN')
            .setRequired(false)
       )
       .addStringOption(opt =>
         opt.setName('reason')
            .setDescription('Reason for the payment')
            .setRequired(false)
       )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'create') {
    const amount = interaction.options.getNumber('amount', true);
    const tokenSymbol = (interaction.options.getString('token') ?? 'COIN').toUpperCase();
    const reason = interaction.options.getString('reason') ?? 'Service Payment';
    const id = (uuidv4().split('-')[0] ?? 'INV').toUpperCase();

    try {
      let tokenAddress = null;
      if (tokenSymbol !== 'COIN') {
        const tokenRow = await getTokenBySymbol(tokenSymbol);
        if (!tokenRow) {
           return interaction.reply({ embeds: [error(`Token **${tokenSymbol}** is not supported by the protocol.`) ], ephemeral: true });
        }
        tokenAddress = tokenRow.address;
      }

      await pool.query(
        'INSERT INTO payment_links (id, creator_id, amount, token_symbol, token_address, reason) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, interaction.user.id, amount, tokenSymbol, tokenAddress, reason]
      );

      const explorerBase = process.env.EXPLORER_URL ?? 'http://localhost:3000/explorer';
      const checkoutUrl = `${explorerBase.replace('/explorer', '')}/pay/${id}`;

      const embed = new EmbedBuilder()
        .setColor(0x635BFF) // Stripe Purple
        .setTitle('💳 Payment Invoice Request')
        .setDescription(`Requesting **${amount} ${tokenSymbol}** for **${reason}**`)
        .addFields(
          { name: '💰 Total', value: `**${amount} ${tokenSymbol}**`, inline: true },
          { name: '🆔 ID', value: id, inline: true },
        )
        .setFooter({ text: 'Pay securely via Zenith Checkout' });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setLabel('🔗 Open Stripe-style Checkout')
          .setStyle(ButtonStyle.Link)
          .setURL(checkoutUrl),
        new ButtonBuilder()
          .setCustomId(`pay_internal_${id}`)
          .setLabel('🤖 Instant Bot Pay')
          .setStyle(ButtonStyle.Secondary)
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    } catch (err) {
      console.error(err);
      return interaction.reply({ embeds: [error('Failed to generate payment link.')], ephemeral: true });
    }
  }
}
