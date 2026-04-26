export function formatAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatCOIN(wei: bigint, decimals: number = 2): string {
  const etherString = wei.toString().padStart(19, "0");
  const wholePart = etherString.slice(0, -18) || "0";
  const fractionalPart = etherString.slice(-18).slice(0, decimals);
  return `${wholePart}.${fractionalPart.padEnd(decimals, "0")}`;
}

export function parseCOIN(amount: string, decimals: number = 18): bigint {
  try {
    const [whole, fraction = ""] = amount.split(".");
    const paddedFraction = fraction.padEnd(decimals, "0").slice(0, decimals);
    return BigInt(whole + paddedFraction);
  } catch {
    return 0n;
  }
}

export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatBlockAge(secondsAgo: number): string {
  if (secondsAgo < 60) return `${Math.floor(secondsAgo)}s ago`;
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`;
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`;
  return `${Math.floor(secondsAgo / 86400)}d ago`;
}

export function isMintEventAuthorized(from: string, mintControllerAddress: string): boolean {
  return from.toLowerCase() === mintControllerAddress.toLowerCase();
}
