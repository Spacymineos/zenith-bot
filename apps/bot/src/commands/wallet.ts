import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import { encryptPrivateKey } from '@chainbot/shared';
import { getWallet, saveWallet } from '../lib/db.js';
import { success, error, warning, BRAND_FOOTER } from '../lib/discord.js';

export const data = new SlashCommandBuilder()
  .setName('wallet')
  .setDescription('Manage your ChainBot wallet')
  .addSubcommand(sub =>
    sub.setName('create')
       .setDescription('Generate a new custodial wallet linked to your Discord account')
  )
  .addSubcommand(sub =>
    sub.setName('import')
       .setDescription('Link an existing MetaMask / EOA address (view-only)')
       .addStringOption(opt =>
         opt.setName('address')
            .setDescription('Your 0x Ethereum address')
            .setRequired(true)
       )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  // ── CREATE ──────────────────────────────────────────────────────────────────
  if (sub === 'create') {
    await interaction.deferReply({ ephemeral: true });

    const existing = await getWallet(interaction.user.id);
    if (existing) {
      return interaction.editReply({
        embeds: [warning('Wallet Already Exists',
          `You already have a wallet linked: \`${existing.address}\`\nUse \`/balance\` to check your funds.`
        )],
      });
    }

    // Generate fresh wallet
    const wallet = ethers.Wallet.createRandom();
    const encryptedKey = encryptPrivateKey(wallet.privateKey);

    await saveWallet(interaction.user.id, wallet.address.toLowerCase(), encryptedKey, true);

    // DM the user their credentials
    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('🔐 Your New ChainBot Wallet — KEEP THIS PRIVATE')
        .addFields(
          { name: '📬 Address (safe to share)', value: `\`${wallet.address}\`` },
          { name: '🔑 Private Key (NEVER share this!)', value: `\`\`\`${wallet.privateKey}\`\`\`` },
          {
            name: '⚠️ Security Warning',
            value: [
              '**Never share your private key with anyone.**',
              'ChainBot staff will NEVER ask for it.',
              'Store it in a secure password manager.',
              'This message will not be sent again.',
            ].join('\n'),
          }
        )
        .setFooter({ text: BRAND_FOOTER })
        .setTimestamp();

      await interaction.user.send({ embeds: [dmEmbed] });
    } catch {
      // DMs closed — still created, warn the user
      return interaction.editReply({
        embeds: [warning('Wallet Created — Enable DMs!',
          `Your wallet \`${wallet.address}\` was created but we couldn't DM you your private key.\n\n` +
          '⚠️ **Enable DMs from server members in Privacy Settings and run `/wallet create` again** after deleting your wallet, OR contact an admin.'
        )],
      });
    }

    return interaction.editReply({
      embeds: [success('Wallet Created!',
        '✉️ Check your DMs for your wallet address and private key.\n\n' +
        '> **Never share your private key with anyone — not even ChainBot staff.**'
      )],
    });
  }

  // ── IMPORT ───────────────────────────────────────────────────────────────────
  if (sub === 'import') {
    await interaction.deferReply({ ephemeral: true });

    const rawAddress = interaction.options.getString('address', true).trim();

    if (!ethers.isAddress(rawAddress)) {
      return interaction.editReply({
        embeds: [error('Invalid Ethereum address. Make sure it starts with `0x` and is 42 characters long.')],
      });
    }

    const address = rawAddress.toLowerCase();
    const existing = await getWallet(interaction.user.id);
    if (existing) {
      return interaction.editReply({
        embeds: [warning('Already Linked',
          `Your Discord is already linked to \`${existing.address}\`.\nContact an admin to unlink.`
        )],
      });
    }

    await saveWallet(interaction.user.id, address, null, false);

    return interaction.editReply({
      embeds: [
        success('Address Linked (View-Only)',
          `**Address:** \`${rawAddress}\`\n\n` +
          '> This is a **view-only** link. You can check balances but cannot send transactions through the bot. ' +
          'To use full bot features, create a custodial wallet with `/wallet create`.'
        ),
      ],
    });
  }
}
