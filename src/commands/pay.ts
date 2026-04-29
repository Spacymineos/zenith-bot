import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from 'discord.js';
import { prisma, getTokenBySymbol, error, BRAND_FOOTER } from '../core.js';
import { v4 as uuidv4 } from 'uuid';

export const data = new SlashCommandBuilder().setName('pay').setDescription('Payment links')
  .addSubcommand(sub => sub.setName('create').setDescription('Create invoice')
    .addNumberOption(opt => opt.setName('amount').setDescription('Amount').setMinValue(0.0001).setRequired(true))
    .addStringOption(opt => opt.setName('token').setDescription('Token (ZENITH, USD...)'))
    .addStringOption(opt => opt.setName('reason').setDescription('Reason')));

export async function execute(interaction: ChatInputCommandInteraction) {
  if (interaction.options.getSubcommand() !== 'create') return;
  const amount = interaction.options.getNumber('amount', true);
  const tokenSymbol = (interaction.options.getString('token') ?? 'ZENITH').toUpperCase();
  const reason = interaction.options.getString('reason') ?? 'Service Payment';
  const id = uuidv4().split('-')[0]!.toUpperCase();

  try {
    let tokenAddress = null;
    if (tokenSymbol !== 'COIN' && tokenSymbol !== 'ZENITH') {
      const row = await getTokenBySymbol(tokenSymbol);
      if (!row) return interaction.reply({ embeds: [error(`Token **${tokenSymbol}** not supported.`) ], ephemeral: true });
      tokenAddress = row.address;
    }

    await prisma.paymentLink.create({
      data: {
        id,
        creatorId: interaction.user.id,
        amount: amount,
        tokenSymbol,
        tokenAddress,
        reason,
      }
    });
    const checkoutUrl = `${(process.env.EXPLORER_URL ?? 'http://localhost:3000/explorer').replace('/explorer', '')}/pay/${id}`;

    const embed = new EmbedBuilder().setColor(0x635BFF).setTitle('💳 Payment Invoice Request')
      .setDescription(`Requesting **${amount} ${tokenSymbol}** for **${reason}**`)
      .addFields({ name: '💰 Total', value: `**${amount} ${tokenSymbol}**`, inline: true }, { name: '🆔 ID', value: id, inline: true })
      .setFooter(BRAND_FOOTER);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setLabel('🔗 Checkout Link').setStyle(ButtonStyle.Link).setURL(checkoutUrl),
      new ButtonBuilder().setCustomId(`pay_internal_${id}`).setLabel('🤖 Bot Pay').setStyle(ButtonStyle.Secondary)
    );
    return interaction.reply({ embeds: [embed], components: [row] });
  } catch (err) { return interaction.reply({ embeds: [error('Failed to generate link.')], ephemeral: true }); }
}


