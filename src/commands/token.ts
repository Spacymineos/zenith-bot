import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import { contract, erc20, uniswapPair, signerFromWalletRow, safeEstimateGas, explorerToken, formatCOIN } from '../core.js';
import { getWallet, saveToken, getTokenBySymbol, error, warning, BRAND_COLOR, BRAND_FOOTER, fmtUSD, getErrorMessage } from '../core.js';

export const data = new SlashCommandBuilder().setName('token').setDescription('Tokens')
  .addSubcommand(sub => sub.setName('create').setDescription('Deploy ERC-20').addStringOption(o => o.setName('name').setRequired(true)).addStringOption(o => o.setName('ticker').setRequired(true)))
  .addSubcommand(sub => sub.setName('info').setDescription('Token stats').addStringOption(o => o.setName('ticker').setRequired(true)));

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'create') {
    await interaction.deferReply();
    const walletRow = await getWallet(interaction.user.id);
    if (!walletRow?.isCustodial) return interaction.editReply({ embeds: [error("Need custodial wallet.")] });
    const name = interaction.options.getString('name', true).trim(), ticker = interaction.options.getString('ticker', true).toUpperCase().trim();
    if (await getTokenBySymbol(ticker)) return interaction.editReply({ embeds: [warning('Taken', `Ticker **${ticker}** exists.`)] });

    try {
      const signer = signerFromWalletRow(walletRow), factory = contract('MemeCoinFactory', signer), fee = await factory.getCreationFee();
      if ((await signer.provider!.getBalance(walletRow.address)) < fee) return interaction.editReply({ embeds: [error(`Insufficient balance.`)] });
      const tx = await safeEstimateGas(factory.createToken(name, ticker, { value: fee })), receipt = await tx.wait(1);
      let tokenAddr = '(check explorer)';
      const iface = new ethers.Interface(['event TokenCreated(address indexed token, string name, string symbol)']);
      for (const log of receipt!.logs) {
        try { const p = iface.parseLog(log); if (p?.name === 'TokenCreated') { tokenAddr = p.args.token; break; } } catch {}
      }
      await saveToken(ticker, name, tokenAddr, interaction.user.id);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('🚀 Token Deployed!').setDescription(`**${name} (${ticker})** created at \`${tokenAddr}\`.\n\n[View](${explorerToken(tokenAddr)})`).setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
    } catch (err: unknown) { return interaction.editReply({ embeds: [error(`Failed: ${getErrorMessage(err)}`)] }); }
  }

  if (sub === 'info') {
    await interaction.deferReply();
    const ticker = interaction.options.getString('ticker', true).toUpperCase().trim();
    let addr: string | undefined = (await getTokenBySymbol(ticker))?.address;
    if (!addr) addr = await contract('MemeCoinFactory').getTokenBySymbol(ticker).catch(() => undefined);
    if (!addr || addr === ethers.ZeroAddress) return interaction.editReply({ embeds: [error(`Token **${ticker}** not found.`)] });

    try {
      const tk = erc20(addr), [name, symbol, supply, decimals] = await Promise.all([tk.name(), tk.symbol(), tk.totalSupply(), tk.decimals()]);
      return interaction.editReply({ embeds: [new EmbedBuilder().setColor(BRAND_COLOR).setTitle(`💎 ${name} (${symbol})`).addFields({ name: '📊 Supply', value: formatCOIN(supply, Number(decimals)), inline: true }, { name: '📋 Contract', value: `\`${addr}\``, inline: false }).setFooter({ text: BRAND_FOOTER }).setTimestamp()] });
    } catch (err: unknown) { return interaction.editReply({ embeds: [error(`Failed: ${getErrorMessage(err)}`)] }); }
  }
}


