import { EmbedBuilder } from "discord.js";

export const BRAND_COLOR = 0x7f77dd;
export const BRAND_FOOTER = "Zenith • zenith.animeos.dev";
export const COIN_EMOJI = "🪙";
export const CHECK_EMOJI = "✅";
export const WARN_EMOJI = "⚠️";
export const ERR_EMOJI = "❌";
export const HASH_EMOJI = "⛏️";

/**
 * Base branded embed — all other helpers build on this.
 */
export function base(title: string, description: string = ""): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(BRAND_COLOR)
    .setTitle(title)
    .setDescription(description || null)
    .setFooter({ text: BRAND_FOOTER })
    .setTimestamp();
}

export function success(title: string, description: string = ""): EmbedBuilder {
  return base(`${CHECK_EMOJI} ${title}`, description);
}

export function error(description: string): EmbedBuilder {
  return base(`${ERR_EMOJI} Error`).setDescription(description).setColor(0xed4245);
}

export function warning(title: string, description: string = ""): EmbedBuilder {
  return base(`${WARN_EMOJI} ${title}`, description).setColor(0xfee75c);
}

export function loading(description: string = "Processing your request…"): EmbedBuilder {
  return base("⏳ Working…", description).setColor(0x5865f2);
}

/**
 * Format a duration in seconds to a human-readable string.
 */
export function formatCooldown(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/**
 * Format a COIN amount with trailing zeros stripped.
 */
export function fmtCoin(amount: string | number): string {
  const n = parseFloat(String(amount));
  if (isNaN(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/**
 * Format USD value.
 */
export function fmtUSD(value: string | number): string {
  return `$${parseFloat(String(value)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })}`;
}

/**
 * Truncate an Ethereum address for display.
 */
export function shortAddr(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Rank medal emoji.
 */
export function rankEmoji(i: number): string {
  return ["🥇", "🥈", "🥉"][i] ?? `**#${i + 1}**`;
}
