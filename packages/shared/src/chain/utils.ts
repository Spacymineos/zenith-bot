import { EXPLORER_URL } from "../constants/index";
import { Contract, Provider, Signer, formatUnits, parseUnits } from "ethers";
import { getProvider } from "./provider";
import { CONTRACT_ADDRESSES, ABIS } from "@chainbot/config";

export async function safeEstimateGas(txPromise: Promise<any>): Promise<any> {
  try {
    return await txPromise;
  } catch (err: any) {
    const msg = err?.message?.toLowerCase() ?? "";
    if (msg.includes("insufficient funds"))
      throw new Error("Insufficient funds to cover gas fees.");
    if (msg.includes("execution reverted"))
      throw new Error(`Transaction reverted: ${err?.reason ?? "Unknown reason"}`);
    throw new Error(`Gas estimation failed: ${err.message}`);
  }
}

export function withSlippage(amount: bigint, slippageBps: bigint = 50n): bigint {
  // 50 bps = 0.5%
  return (amount * (10000n - slippageBps)) / 10000n;
}

export function explorerTx(hash: string): string {
  return `${EXPLORER_URL}/tx/${hash}`;
}

export function explorerAddr(addr: string): string {
  return `${EXPLORER_URL}/address/${addr}`;
}

export function explorerToken(addr: string): string {
  return `${EXPLORER_URL}/token/${addr}`;
}

export function parseCoin(amount: number | string, decimals: number = 18): bigint {
  return parseUnits(String(amount), decimals);
}

// ─── Generic contract factory ──────────────────────────────────────────────────
export function contract(name: string, signerOrProvider?: Signer | Provider): Contract {
  const provider = signerOrProvider ?? getProvider();
  // @ts-ignore - dynamic access to CONTRACT_ADDRESSES and ABIS
  return new Contract(CONTRACT_ADDRESSES[name], ABIS[name], provider);
}

export function erc20(address: string, signerOrProvider?: Signer | Provider): Contract {
  const provider = signerOrProvider ?? getProvider();
  // @ts-ignore - dynamic access to ABIS
  return new Contract(address, ABIS.ERC20, provider);
}

export function uniswapPair(address: string, signerOrProvider?: Signer | Provider): Contract {
  const provider = signerOrProvider ?? getProvider();
  // @ts-ignore
  return new Contract(address, ABIS.UniswapV2Pair, provider);
}

// Legacy name support (maps to formatCOIN from logic/token.ts)
export function formatCoin(bigint: bigint, decimals: number = 18, places: number = 4): string {
  return parseFloat(formatUnits(bigint, decimals)).toFixed(places);
}
