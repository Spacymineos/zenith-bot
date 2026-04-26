import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected error on idle client:", err);
});

// ─── Schema Bootstrap ──────────────────────────────────────────────────────────
export async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS wallets (
        discord_id      TEXT PRIMARY KEY,
        address         TEXT NOT NULL UNIQUE,
        encrypted_key   TEXT,          -- NULL for view-only imported wallets
        is_custodial    BOOLEAN DEFAULT TRUE,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS cooldowns (
        discord_id  TEXT NOT NULL,
        command     TEXT NOT NULL,
        last_used   TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (discord_id, command)
      );

      CREATE TABLE IF NOT EXISTS job_history (
        id          SERIAL PRIMARY KEY,
        discord_id  TEXT NOT NULL,
        job_title   TEXT NOT NULL,
        reward      NUMERIC NOT NULL,
        tx_hash     TEXT,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS token_registry (
        symbol      TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        address     TEXT NOT NULL UNIQUE,
        creator_id  TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS payment_links (
        id              TEXT PRIMARY KEY,
        creator_id      TEXT NOT NULL,
        amount          NUMERIC NOT NULL,
        token_symbol    TEXT DEFAULT 'COIN',
        token_address   TEXT, -- NULL for native COIN
        reason          TEXT,
        status          TEXT DEFAULT 'pending', -- pending, paid, cancelled
        created_at      TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS cooldowns_discord_id_idx ON cooldowns(discord_id);
      CREATE INDEX IF NOT EXISTS job_history_discord_id_idx ON job_history(discord_id);
    `);
    console.log("[DB] Schema initialized");
  } finally {
    client.release();
  }
}

// ─── Wallet Helpers ────────────────────────────────────────────────────────────
export async function getWallet(discordId: string) {
  const res = await pool.query("SELECT * FROM wallets WHERE discord_id = $1", [discordId]);
  return res.rows[0] ?? null;
}

export async function saveWallet(
  discordId: string,
  address: string,
  encryptedKey: string | null,
  isCustodial: boolean = true
) {
  await pool.query(
    `INSERT INTO wallets (discord_id, address, encrypted_key, is_custodial)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (discord_id) DO UPDATE
       SET address = EXCLUDED.address,
           encrypted_key = EXCLUDED.encrypted_key,
           is_custodial = EXCLUDED.is_custodial`,
    [discordId, address, encryptedKey, isCustodial]
  );
}

export async function getWalletByAddress(address: string) {
  const res = await pool.query("SELECT * FROM wallets WHERE address = $1", [
    address.toLowerCase(),
  ]);
  return res.rows[0] ?? null;
}

// ─── Cooldown Helpers ──────────────────────────────────────────────────────────
/**
 * Returns seconds remaining on cooldown, or 0 if ready.
 */
export async function getCooldown(discordId: string, command: string): Promise<number> {
  const res = await pool.query(
    "SELECT last_used FROM cooldowns WHERE discord_id = $1 AND command = $2",
    [discordId, command]
  );
  if (!res.rows[0]) return 0;
  const lastUsed = new Date(res.rows[0].last_used).getTime();
  const cooldownMs = COOLDOWN_MAP[command as keyof typeof COOLDOWN_MAP] ?? 0;
  const remaining = cooldownMs - (Date.now() - lastUsed);
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

export async function setCooldown(discordId: string, command: string) {
  await pool.query(
    `INSERT INTO cooldowns (discord_id, command, last_used)
     VALUES ($1, $2, NOW())
     ON CONFLICT (discord_id, command) DO UPDATE SET last_used = NOW()`,
    [discordId, command]
  );
}

const COOLDOWN_MAP = {
  daily: 86_400_000, // 24h
  work: 3_600_000, // 1h
  gamble: 60_000, // 1 min anti-spam
  send: 10_000, // 10s anti-spam
};

// ─── Job History ───────────────────────────────────────────────────────────────
export async function logJob(
  discordId: string,
  jobTitle: string,
  reward: number,
  txHash: string | null = null
) {
  await pool.query(
    "INSERT INTO job_history (discord_id, job_title, reward, tx_hash) VALUES ($1, $2, $3, $4)",
    [discordId, jobTitle, reward, txHash]
  );
}

// ─── Token Registry ────────────────────────────────────────────────────────────
export async function registerToken(
  symbol: string,
  name: string,
  address: string,
  creatorId: string
) {
  await pool.query(
    `INSERT INTO token_registry (symbol, name, address, creator_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (symbol) DO NOTHING`,
    [symbol.toUpperCase(), name, address.toLowerCase(), creatorId]
  );
}

export async function getTokenBySymbol(symbol: string) {
  const res = await pool.query("SELECT * FROM token_registry WHERE symbol = $1", [
    symbol.toUpperCase(),
  ]);
  return res.rows[0] ?? null;
}
