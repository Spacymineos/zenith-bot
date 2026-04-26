import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, ComponentType } from 'discord.js';
import { ethers } from 'ethers';
import {
  contract, erc20, signerFromWalletRow,
  safeEstimateGas, explorerTx,
  formatCOIN, parseCOIN, withSlippage
} from '@chainbot/shared';
import { getWallet, getTokenBySymbol } from '../lib/db.js';
import { error, warning, success, BRAND_COLOR, BRAND_FOOTER } from '../lib/discord.js';

const NATIVE_SYMBOL = 'COIN';

async function resolveToken(ticker: string) {
  if (ticker.toUpperCase() === NATIVE_SYMBOL) return { isNative: true, address: null, decimals: 18 };
  const row = await getTokenBySymbol(ticker);
  if (row) {
    const tk = erc20(row.address);
    const decimals = Number(await (tk as any).decimals());
    return { isNative: false, address: row.address, decimals };
  }
  // Try factory lookup
  const addr = await (contract('MemeCoinFactory') as any).getTokenBySymbol(ticker).catch(() => null);
  if (addr && addr !== ethers.ZeroAddress) {
    const tk = erc20(addr);
    const decimals = Number(await (tk as any).decimals());
    return { isNative: false, address: addr, decimals };
  }
  return null;
}

export const data = new SlashCommandBuilder()
  .setName('swap')
  .setDescription('Swap tokens via the DEX (Uniswap V2)')
  .addStringOption(opt =>
    opt.setName('from_token')
       .setDescription('Token to sell (e.g. COIN, DOGE)')
       .setRequired(true)
  )
  .addStringOption(opt =>
    opt.setName('to_token')
       .setDescription('Token to buy (e.g. DOGE, COIN)')
       .setRequired(true)
  )
  .addNumberOption(opt =>
    opt.setName('amount')
       .setDescription('Amount of from_token to sell')
       .setMinValue(0.000001)
       .setRequired(true)
  )
  .addIntegerOption(opt =>
    opt.setName('slippage')
       .setDescription('Max slippage in basis points (default: 50 = 0.5%)')
       .setMinValue(1)
       .setMaxValue(3000)
       .setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  await interaction.deferReply();

  const walletRow = await getWallet(interaction.user.id);
  if (!walletRow) return interaction.editReply({ embeds: [error("No wallet found. Use `/wallet create` first.")] });
  if (!walletRow.is_custodial) return interaction.editReply({ embeds: [error('View-only wallets cannot execute swaps.')] });

  const fromTicker = interaction.options.getString('from_token', true).toUpperCase();
  const toTicker = interaction.options.getString('to_token', true).toUpperCase();
  const amount = interaction.options.getNumber('amount', true);
  const slippageBps = BigInt(interaction.options.getInteger('slippage') ?? 50);

  if (fromTicker === toTicker) {
    return interaction.editReply({ embeds: [error('Cannot swap a token for itself.')] });
  }

  // Resolve tokens
  const [fromToken, toToken] = await Promise.all([
    resolveToken(fromTicker).catch(() => null),
    resolveToken(toTicker).catch(() => null),
  ]);

  if (!fromToken) return interaction.editReply({ embeds: [error(`Token **${fromTicker}** not found.`)] });
  if (!toToken) return interaction.editReply({ embeds: [error(`Token **${toTicker}** not found.`)] });

  try {
    const signer = signerFromWalletRow(walletRow);
    const router = contract('UniswapV2Router', signer);
    const weth = await (router as any).WETH();
    const amountIn = parseCOIN(amount.toString(), fromToken.decimals);

    // Build swap path
    const fromAddr = fromToken.isNative ? weth : fromToken.address;
    const toAddr = toToken.isNative ? weth : toToken.address;
    const path = fromAddr.toLowerCase() === toAddr.toLowerCase()
      ? [fromAddr, toAddr]
      : [fromAddr, weth, toAddr].filter((v, i, a) => a.indexOf(v) === i); // dedup weth if already in path

    // Get estimated output
    const amounts = await (router as any).getAmountsOut(amountIn, path);
    const amountOut = amounts[amounts.length - 1];
    const amountOutMin = withSlippage(amountOut, slippageBps);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300); // 5 min

    const estOut = formatCOIN(amountOut, toToken.decimals);
    const minOut = formatCOIN(amountOutMin, toToken.decimals);
    const slipPct = (Number(slippageBps) / 100).toFixed(2);

    // Show confirmation embed with a Confirm button
    const confirmEmbed = new EmbedBuilder()
      .setColor(BRAND_COLOR)
      .setTitle('🔄 Swap Preview')
      .addFields(
        { name: '📤 Selling', value: `**${amount} ${fromTicker}**`, inline: true },
        { name: '📥 Estimated Out', value: `**${estOut} ${toTicker}**`, inline: true },
        { name: '⚠️ Minimum Out', value: `${minOut} ${toTicker}`, inline: true },
        { name: '📉 Slippage', value: `${slipPct}%`, inline: true },
        { name: '⏱️ Deadline', value: '5 minutes', inline: true },
      )
      .setDescription('React with ✅ to confirm or ❌ to cancel.')
      .setFooter({ text: BRAND_FOOTER });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('swap_confirm').setLabel('✅ Confirm Swap').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('swap_cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger),
    );

    const msg = await interaction.editReply({ embeds: [confirmEmbed], components: [row] });
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60_000, max: 1 });

    collector.on('collect', async btn => {
      if (btn.user.id !== interaction.user.id) {
        return btn.reply({ content: 'Only the command sender can confirm this swap.', ephemeral: true });
      }
      await btn.deferUpdate();

      if (btn.customId === 'swap_cancel') {
        return interaction.editReply({ embeds: [warning('Swap Cancelled', 'No tokens were swapped.')], components: [] });
      }

      // Execute the actual swap
      try {
        let tx;
        const routerAddr = await (router as any).getAddress();
        if (fromToken.isNative) {
          // COIN → token
          tx = await safeEstimateGas(
            (router as any).swapExactETHForTokens(amountOutMin, path, walletRow.address, deadline, { value: amountIn })
          );
        } else if (toToken.isNative) {
          // token → COIN (need approve first)
          const tkContract = erc20(fromToken.address as string, signer);
          const allowance = await (tkContract as any).allowance(walletRow.address, routerAddr);
          if (allowance < amountIn) {
            const approveTx = await (tkContract as any).approve(routerAddr, ethers.MaxUint256);
            await approveTx.wait(1);
          }
          tx = await safeEstimateGas(
            (router as any).swapExactTokensForETH(amountIn, amountOutMin, path, walletRow.address, deadline)
          );
        } else {
          // token → token
          const tkContract = erc20(fromToken.address as string, signer);
          const allowance = await (tkContract as any).allowance(walletRow.address, routerAddr);
          if (allowance < amountIn) {
            const approveTx = await (tkContract as any).approve(routerAddr, ethers.MaxUint256);
            await approveTx.wait(1);
          }
          tx = await safeEstimateGas(
            (router as any).swapExactTokensForTokens(amountIn, amountOutMin, path, walletRow.address, deadline)
          );
        }

        const receipt = await tx.wait(1);
        if (!receipt) throw new Error('Transaction failed to confirm.');
        const actualOut = formatCOIN(amountOut, toToken.decimals); // approximate

        return interaction.editReply({
          embeds: [
            success('Swap Executed!',
              [
                `**Sold:** ${amount} ${fromTicker}`,
                `**Received:** ~${actualOut} ${toTicker}`,
                `**Tx:** [View on Explorer](${explorerTx(receipt.hash)})`,
              ].join('\n')
            ),
          ],
          components: [],
        });
      } catch (swapErr: any) {
        return interaction.editReply({
          embeds: [error(swapErr.message ?? 'Swap failed.')],
          components: [],
        });
      }
    });

    collector.on('end', (_, reason) => {
      if (reason === 'time') {
        interaction.editReply({
          embeds: [warning('Swap Expired', 'You did not confirm in time. No swap was made.')],
          components: [],
        }).catch(() => {});
      }
    });
  } catch (err: any) {
    return interaction.editReply({ embeds: [error(err.message ?? 'Failed to prepare swap.')] });
  }
}
