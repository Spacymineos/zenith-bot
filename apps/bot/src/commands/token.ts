import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction } from 'discord.js';
import { ethers } from 'ethers';
import {
  contract, erc20, uniswapPair, signerFromWalletRow,
  safeEstimateGas, explorerToken, formatCOIN
} from '@chainbot/shared';
import { getWallet, registerToken, getTokenBySymbol } from '../lib/db.js';
import {
  error, warning, fmtCoin, fmtUSD,
  BRAND_COLOR, BRAND_FOOTER
} from '../lib/discord.js';

export const data = new SlashCommandBuilder()
  .setName('token')
  .setDescription('Create and explore tokens')
  .addSubcommand(sub =>
    sub.setName('create')
       .setDescription('Deploy a new ERC-20 meme token via the MemeCoinFactory')
       .addStringOption(opt =>
         opt.setName('name')
            .setDescription('Full token name (e.g. "Doge Coin")')
            .setRequired(true)
            .setMaxLength(32)
       )
       .addStringOption(opt =>
         opt.setName('ticker')
            .setDescription('Token ticker/symbol (e.g. DOGE)')
            .setRequired(true)
            .setMaxLength(10)
       )
  )
  .addSubcommand(sub =>
    sub.setName('info')
       .setDescription('Get token price, market cap, and stats')
       .addStringOption(opt =>
         opt.setName('ticker')
            .setDescription('Token ticker (e.g. DOGE)')
            .setRequired(true)
       )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  const sub = interaction.options.getSubcommand();

  // ── CREATE ──────────────────────────────────────────────────────────────────
  if (sub === 'create') {
    await interaction.deferReply();

    const walletRow = await getWallet(interaction.user.id);
    if (!walletRow) {
      return interaction.editReply({ embeds: [error("You need a wallet first. Use `/wallet create`.")] });
    }
    if (!walletRow.is_custodial) {
      return interaction.editReply({ embeds: [error('Token creation requires a custodial wallet.')] });
    }

    const name = interaction.options.getString('name', true).trim();
    const ticker = interaction.options.getString('ticker', true).toUpperCase().trim();

    // Check for duplicate symbol in DB cache
    const existing = await getTokenBySymbol(ticker);
    if (existing) {
      return interaction.editReply({
        embeds: [warning('Symbol Taken',
          `The ticker **${ticker}** is already registered at \`${existing.address}\`.`
        )],
      });
    }

    try {
      const signer = signerFromWalletRow(walletRow);
      const factory = contract('MemeCoinFactory', signer);
      const fee = await (factory as any).getCreationFee();
      const provider = signer.provider;
      if (!provider) throw new Error('Provider not available.');

      // Confirm user has enough balance for fee
      const bal = await provider.getBalance(walletRow.address);
      if (bal < fee) {
        return interaction.editReply({
          embeds: [error(
            `Insufficient balance. Token creation costs **${formatCOIN(fee)} COIN**. ` +
            `You have **${formatCOIN(bal)} COIN**.`
          )],
        });
      }
  
      const tx = await safeEstimateGas((factory as any).createToken(name, ticker, { value: fee }));
      const receipt = await tx.wait(1);

      if (!receipt) throw new Error('Transaction failed to confirm.');

      // Parse the created token address from logs (event: TokenCreated(address,string,string))
      let tokenAddr = '(check explorer)';
      try {
        const iface = new ethers.Interface(['event TokenCreated(address indexed token, string name, string symbol)']);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog(log);
            if (parsed?.name === 'TokenCreated') {
              tokenAddr = parsed.args.token;
              break;
            }
          } catch { /* not our event */ }
        }
      } catch { /* skip */ }

      // Register in DB
      if (tokenAddr !== '(check explorer)') {
        await registerToken(ticker, name, tokenAddr, interaction.user.id);
      }

      const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle('🚀 Token Deployed!')
        .addFields(
          { name: '📛 Name', value: name, inline: true },
          { name: '💲 Ticker', value: ticker, inline: true },
          { name: '🏭 Address', value: `\`${tokenAddr}\``, inline: false },
          { name: '💸 Fee Paid', value: `${formatCOIN(fee)} COIN`, inline: true },
          { name: '🔗 Explorer', value: `[View Token](${explorerToken(tokenAddr)})`, inline: true },
        )
        .setFooter({ text: BRAND_FOOTER })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      return interaction.editReply({ embeds: [error(err.message ?? 'Failed to create token.')] });
    }
  }

  // ── INFO ────────────────────────────────────────────────────────────────────
  if (sub === 'info') {
    await interaction.deferReply();

    const ticker = interaction.options.getString('ticker', true).toUpperCase().trim();
    const tokenRow = await getTokenBySymbol(ticker);

    let tokenAddress: string;
    if (tokenRow) {
      tokenAddress = tokenRow.address;
    } else {
      // Try on-chain lookup via factory
      try {
        tokenAddress = await (contract('MemeCoinFactory') as any).getTokenBySymbol(ticker);
        if (!tokenAddress || tokenAddress === ethers.ZeroAddress) throw new Error();
      } catch {
        return interaction.editReply({
          embeds: [error(`Token **${ticker}** not found. Check the ticker and try again.`)],
        });
      }
    }

    try {
      const tk = erc20(tokenAddress);
      const weth = await (contract('UniswapV2Router') as any).WETH();
      const pair = await (contract('UniswapV2Factory') as any).getPair(tokenAddress, weth);

      const [name, symbol, supply, decimals] = await Promise.all([
        (tk as any).name(), (tk as any).symbol(), (tk as any).totalSupply(), (tk as any).decimals(),
      ]);

      let price = 0, priceChange = '—';

      if (pair && pair !== ethers.ZeroAddress) {
        const pairContract = uniswapPair(pair);
        const [reserves, t0] = await Promise.all([
          (pairContract as any).getReserves(),
          (pairContract as any).token0(),
        ]);
        const isTok0 = t0.toLowerCase() === tokenAddress.toLowerCase();
        const r0 = isTok0 ? reserves.reserve0 : reserves.reserve1;
        const r1 = isTok0 ? reserves.reserve1 : reserves.reserve0;
        // price in terms of WETH (native)
        if (r0 > 0n) {
          const priceWETH = parseFloat(ethers.formatUnits(r1, 18)) / parseFloat(ethers.formatUnits(r0, Number(decimals)));
          // get native COIN price in USD
          const rawNativePrice = await (contract('PriceOracle') as any).getNativePrice().catch(() => 0n);
          const nativeUSD = parseFloat(ethers.formatUnits(rawNativePrice, 8));
          price = priceWETH * nativeUSD;
        }
      }

      try {
        const rawChange = await (contract('PriceOracle') as any).get24hChange(tokenAddress);
        priceChange = `${(Number(rawChange) / 100).toFixed(2)}%`;
      } catch { /* oracle may not have 24h data */ }

      const supplyNum = parseFloat(ethers.formatUnits(supply, Number(decimals)));
      const marketCap = supplyNum * price;

      const embed = new EmbedBuilder()
        .setColor(BRAND_COLOR)
        .setTitle(`📊 ${name} (${symbol})`)
        .addFields(
          { name: '💲 Price', value: price > 0 ? fmtUSD(price) : 'No liquidity', inline: true },
          { name: '📈 24h Change', value: priceChange, inline: true },
          { name: '🏦 Market Cap', value: price > 0 ? fmtUSD(marketCap) : '—', inline: true },
          { name: '🔢 Supply', value: fmtCoin(supplyNum), inline: true },
          { name: '📋 Contract', value: `\`${tokenAddress}\``, inline: false },
          { name: '🔗 Explorer', value: `[View Token](${explorerToken(tokenAddress)})`, inline: true },
        )
        .setFooter({ text: BRAND_FOOTER })
        .setTimestamp();

      return interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      return interaction.editReply({ embeds: [error(`Failed to fetch token info: ${err.message}`)] });
    }
  }
}
