import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { EmbedBuilder } from "discord.js";
import { JsonRpcProvider, Wallet, Contract, Provider, Signer, formatUnits, parseUnits, Network } from "ethers";
import crypto from "crypto";
import { ENV, BRAND, CONTRACT_ADDRESSES, ABIS, type ContractName, type ZenithContracts } from "./config.js";

export { ContractName, ENV };

// ─── UTILS & CONSTANTS ────────────────────────────────────────────────────────
export const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";
export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const BRAND_COLOR = BRAND.COLOR;
export const BRAND_FOOTER = BRAND.FOOTER;

export const getErrorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return JSON.stringify(e);
};
export const formatAddress = (a: string) => a.length < 10 ? a : `${a.slice(0, 6)}...${a.slice(-4)}`;
export const shortAddr = formatAddress;
export const explorerTx = (h: string) => `${ENV.EXPLORER_URL}/tx/${h}`;
export const explorerAddr = (a: string) => `${ENV.EXPLORER_URL}/address/${a}`;
export const explorerToken = (a: string) => `${ENV.EXPLORER_URL}/token/${a}`;
export const parseCOIN = (a: string, d = 18) => parseUnits(a, d);
export const formatCOIN = (w: bigint, d = 18, p = 4) => parseFloat(formatUnits(w, d)).toFixed(p);
export const withSlippage = (a: bigint, b = 50n) => (a * (10000n - b)) / 10000n;
export const formatCooldown = (s: number) => s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s/60)}m ${s%60}s` : `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;
// Zenith Coin formatting helper
export const fmtCoin = (n: number | string) => {
  const v = parseFloat(String(n));
  if (isNaN(v)) return "0";
  return v >= 1e6 ? `${(v/1e6).toFixed(2)}M` : v >= 1e3 ? `${(v/1e3).toFixed(2)}K` : v.toLocaleString("en-US", { maximumFractionDigits: 4 });
};
export const fmtUSD = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

// ─── DATABASE (PRISMA + PG ADAPTER) ─────────────────────────────────────────
export const pool = new pg.Pool({ connectionString: ENV.DATABASE_URL });
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

export const getWallet = (id: string) => prisma.wallet.findUnique({ where: { discordId: id } });

export const saveWallet = async (id: string, a: string, k: string | null, c = true) => {
  await prisma.wallet.upsert({
    where: { discordId: id },
    update: { address: a, encryptedKey: k, isCustodial: c },
    create: { discordId: id, address: a, encryptedKey: k, isCustodial: c },
  });
};

export const getCooldown = async (id: string, c: string) => {
  const r = await prisma.cooldown.findUnique({ where: { discordId_command: { discordId: id, command: c } } });
  return r ? Math.max(0, Math.floor((r.lastUsed.getTime() + 1000 - Date.now()) / 1000)) : 0;
};

export const setCooldown = async (id: string, c: string) => {
  await prisma.cooldown.upsert({
    where: { discordId_command: { discordId: id, command: c } },
    update: { lastUsed: new Date() },
    create: { discordId: id, command: c, lastUsed: new Date() },
  });
};

export const getTokenBySymbol = (s: string) => prisma.tokenRegistry.findUnique({ where: { symbol: s.toUpperCase() } });

export const saveToken = async (s: string, n: string, a: string, c: string) => {
  await prisma.tokenRegistry.create({
    data: { symbol: s.toUpperCase(), name: n, address: a, creatorId: c },
  });
};

// ─── DISCORD UI ──────────────────────────────────────────────────────────────
export const base = (t: string, d = "") => new EmbedBuilder().setColor(BRAND_COLOR).setTitle(t).setDescription(d || null).setFooter({ text: BRAND_FOOTER }).setTimestamp();
export const success = (t: string, d = "") => base(`✅ ${t}`, d).setColor(0x57F287);
export const error = (d: string) => base(`❌ Error`).setDescription(d).setColor(0xed4245);
export const warning = (t: string, d = "") => base(`⚠️ ${t}`, d).setColor(0xfee75c);

// ─── ETHERS HELPERS ───────────────────────────────────────────────────────────
let _provider: JsonRpcProvider | null = null;
export const getProvider = () => {
  if (!_provider) {
    // Force a static network to prevent Ethers from polling and detecting "network changed" errors.
    // We use a custom network object to ensure Ethers doesn't try to "detect" its name or properties.
    const network = new Network("zenith", BigInt(ENV.CHAIN_ID));
    _provider = new JsonRpcProvider(ENV.RPC_URL, network, { staticNetwork: network });
  }
  return _provider;
};

export function signerFromWalletRow(row: { isCustodial?: boolean; encryptedKey?: string | null }, p?: Provider) {
  if (!row.isCustodial || !row.encryptedKey) throw new Error("View-only wallet.");
  const [iv, tag, enc] = row.encryptedKey.split(":");
  const d = crypto.createDecipheriv("aes-256-gcm", Buffer.from(ENV.ENCRYPTION_KEY, "hex"), Buffer.from(iv!, "hex"));
  d.setAuthTag(Buffer.from(tag!, "hex"));
  return new Wallet(d.update(Buffer.from(enc!, "hex")) + d.final("utf8"), p ?? getProvider());
}

export function encryptPrivateKey(pk: string) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", Buffer.from(ENV.ENCRYPTION_KEY, "hex"), iv);
  const enc = Buffer.concat([c.update(pk, "utf8"), c.final()]);
  return [iv.toString("hex"), c.getAuthTag().toString("hex"), enc.toString("hex")].join(":");
}

export const getTreasurySigner = () => new Wallet(ENV.BOT_WALLET_PRIVATE_KEY, getProvider());
export const contract = (n: ContractName, s?: Signer | Provider) => {
  const abi = ABIS[n as keyof typeof ABIS] || ABIS.ERC20;
  return new Contract(CONTRACT_ADDRESSES[n], abi, s ?? getProvider()) as unknown as ZenithContracts;
};
export const erc20 = (a: string, s?: Signer | Provider) => new Contract(a, ABIS.ERC20, s ?? getProvider()) as unknown as ZenithContracts;
export const uniswapPair = (a: string, s?: Signer | Provider) => new Contract(a, ABIS.UniswapV2Pair, s ?? getProvider()) as unknown as ZenithContracts;

export async function safeEstimateGas<T>(p: Promise<T>): Promise<T> {
  try { return await p; } catch (e) {
    const m = getErrorMessage(e).toLowerCase();
    throw new Error(m.includes("insufficient funds") ? "Insufficient funds." : m.includes("reverted") ? `Reverted: ${m}` : `Failed: ${m}`);
  }
}
