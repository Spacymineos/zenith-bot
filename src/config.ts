import "dotenv/config";
import { type InterfaceAbi, type ContractTransactionResponse } from "ethers";
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";

/**
 * PROJECT CONFIGURATION
 * Centralized place for all environment variables and constants.
 * "Worth Millions" quality: clean, typed, and easy to modify.
 */

export interface CommandModule {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void | unknown>;
}

export interface ZenithContracts {
  // MintController
  claimDaily(user: string): Promise<ContractTransactionResponse>;
  mintWork(user: string, amount: bigint): Promise<ContractTransactionResponse>;
  getDailyReward(): Promise<bigint>;
  // MinerRegistry
  getHashrate(miner: string): Promise<bigint>;
   getTopMiners(count: number | bigint): Promise<[string[], bigint[]]>;
   getMinerRank(miner: string): Promise<{ rank: bigint; total: bigint }>;
   getTotalHashrate(): Promise<bigint>;
   getBlockReward(): Promise<bigint>;
  // MemeCoinFactory
  createToken(name: string, symbol: string, options?: { value: bigint }): Promise<ContractTransactionResponse>;
  getCreationFee(): Promise<bigint>;
  getTokenBySymbol(symbol: string): Promise<string>;
  // PriceOracle
  getPrice(asset: string): Promise<bigint>;
  getNativePrice(): Promise<bigint>;
  get24hChange(asset: string): Promise<bigint>;
  // UniswapV2Router
  swapExactTokensForTokens(amountIn: bigint, amountOutMin: bigint, path: string[], to: string, deadline: bigint): Promise<ContractTransactionResponse>;
  swapExactETHForTokens(amountOutMin: bigint, path: string[], to: string, deadline: bigint, options?: { value: bigint }): Promise<ContractTransactionResponse>;
  swapExactTokensForETH(amountIn: bigint, amountOutMin: bigint, path: string[], to: string, deadline: bigint): Promise<ContractTransactionResponse>;
  addLiquidity(tokenA: string, tokenB: string, amountADesired: bigint, amountBDesired: bigint, amountAMin: bigint, amountBMin: bigint, to: string, deadline: bigint): Promise<ContractTransactionResponse>;
  addLiquidityETH(token: string, amountTokenDesired: bigint, amountTokenMin: bigint, amountETHMin: bigint, to: string, deadline: bigint, options?: { value: bigint }): Promise<ContractTransactionResponse>;
  getAmountsOut(amountIn: bigint, path: string[]): Promise<bigint[]>;
  WETH(): Promise<string>;
  getAddress(): Promise<string>;
  // UniswapV2Factory
  getPair(tokenA: string, tokenB: string): Promise<string>;
  // UniswapV2Pair
  getReserves(): Promise<{ reserve0: bigint; reserve1: bigint; blockTimestampLast: number }>;
  token0(): Promise<string>;
  token1(): Promise<string>;
  // VaultManager
  deposit(amount: bigint, options?: { value: bigint }): Promise<ContractTransactionResponse>;
  mint(stablecoin: string, amount: bigint): Promise<ContractTransactionResponse>;
  repay(amount: bigint): Promise<ContractTransactionResponse>;
  getVaultStatus(user: string): Promise<{ collateral: bigint; minted: bigint; ratio: bigint; liquidationPrice: bigint; debt: bigint }>;
  // NFTCollection
  getShopItems(): Promise<[bigint[], string[], bigint[], bigint[]]>;
  purchase(itemId: bigint, options?: { value: bigint }): Promise<ContractTransactionResponse>;
  balanceOf(owner: string): Promise<bigint>;
  tokenOfOwnerByIndex(owner: string, index: number | bigint): Promise<bigint>;
  getItemName(tokenId: bigint): Promise<string>;
  // ERC20
  name(): Promise<string>;
  symbol(): Promise<string>;
  decimals(): Promise<bigint>;
  totalSupply(): Promise<bigint>;
  approve(spender: string, amount: bigint): Promise<ContractTransactionResponse>;
  allowance(owner: string, spender: string): Promise<bigint>;
}

// ─── ENVIRONMENT VARIABLES ──────────────────────────────────────────────────
export const ENV = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN!,
  DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID!,
  DATABASE_URL: process.env.DATABASE_URL!,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY!, // AES-256 key for wallet encryption
  RPC_URL: process.env.RPC_URL ?? "http://geth:8545",
  WS_URL: process.env.WS_URL ?? "ws://geth:8546",
  CHAIN_ID: Number(process.env.CHAIN_ID ?? 13371),
  EXPLORER_URL: process.env.EXPLORER_URL ?? "http://localhost:3000",
  BOT_WALLET_PRIVATE_KEY: process.env.BOT_WALLET_PRIVATE_KEY!, // Treasury/Admin wallet
  DEPLOY_COMMANDS: process.env.DEPLOY === "true",
};

// ─── BRANDING ───────────────────────────────────────────────────────────────
export const BRAND = {
  COLOR: 0x7f77dd,
  FOOTER: "Zenith Protocol",
  NAME: "Zenith Coin",
};

// ─── CONTRACT ADDRESSES ─────────────────────────────────────────────────────
// These are the core protocol contracts deployed on the Zenith Chain.
export const CONTRACT_ADDRESSES = {
  MintController: "0x0000000000000000000000000000000000000001",
  MinerRegistry: "0x0000000000000000000000000000000000000002",
  MemeCoinFactory: "0x0000000000000000000000000000000000000003",
  PriceOracle: "0x0000000000000000000000000000000000000004",
  UniswapV2Router: "0x0000000000000000000000000000000000000005",
  UniswapV2Factory: "0x0000000000000000000000000000000000000006",
  WETH: "0x0000000000000000000000000000000000000007",
  VaultManager: "0x0000000000000000000000000000000000000008",
  NFTCollection: "0x0000000000000000000000000000000000000009",
  LeaderboardHelper: "0x000000000000000000000000000000000000000A",
} as const;

export type ContractName = keyof typeof CONTRACT_ADDRESSES;

// ─── ABIS ───────────────────────────────────────────────────────────────────
export const ABIS = {
  MintController: [
    "function claimDaily(address user) external returns (uint256 amount)",
    "function mintWork(address user, uint256 amount) external",
    "function getDailyReward() external view returns (uint256)",
    "function getBaseReward() external view returns (uint256)"
  ],
  MinerRegistry: [
    "function getHashrate(address miner) external view returns (uint256)",
    "function getTopMiners(uint256 count) external view returns (address[] memory miners, uint256[] memory hashrates)",
    "function getMinerRank(address miner) external view returns (uint256 rank, uint256 total)",
    "function getTotalHashrate() external view returns (uint256)",
    "function getBlockReward() external view returns (uint256)"
  ],
  MemeCoinFactory: [
    "function createToken(string memory name, string memory symbol) external payable returns (address tokenAddress)",
    "function getCreationFee() external view returns (uint256)",
    "function getTokenBySymbol(string memory symbol) external view returns (address)"
  ],
  PriceOracle: [
    "function getPrice(address asset) external view returns (uint256 priceUSD)",
    "function getNativePrice() external view returns (uint256 priceUSD)",
    "function get24hChange(address asset) external view returns (int256 changePercent)"
  ],
  UniswapV2Router: [
    "function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)",
    "function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)",
    "function addLiquidity(address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline) external returns (uint amountA, uint amountB, uint liquidity)",
    "function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)",
    "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
    "function WETH() external pure returns (address)"
  ],
  UniswapV2Factory: [
    "function getPair(address tokenA, address tokenB) external view returns (address pair)"
  ],
  UniswapV2Pair: [
    "function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function totalSupply() external view returns (uint256)"
  ],
  VaultManager: [
    "function deposit(uint256 amount) external payable",
    "function mint(address stablecoin, uint256 amount) external",
    "function repay(uint256 amount) external",
    "function getVaultStatus(address user) external view returns (uint256 collateral, uint256 minted, uint256 ratio, uint256 liquidationPrice)",
    "function getMinRatio() external view returns (uint256)"
  ],
  NFTCollection: [
    "function getShopItems() external view returns (uint256[] memory ids, string[] memory names, uint256[] memory prices, uint256[] memory stocks)",
    "function purchase(uint256 itemId) external payable",
    "function balanceOf(address owner) external view returns (uint256)",
    "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
    "function tokenURI(uint256 tokenId) external view returns (string memory)",
    "function getItemName(uint256 tokenId) external view returns (string memory)"
  ],
  ERC20: [
    "function name() external view returns (string memory)",
    "function symbol() external view returns (string memory)",
    "function decimals() external view returns (uint8)",
    "function balanceOf(address account) external view returns (uint256)",
    "function totalSupply() external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function transfer(address to, uint256 amount) external returns (bool)"
  ]
} satisfies Record<string, InterfaceAbi>;
