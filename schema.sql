-- ChainBot PostgreSQL Schema
-- Run this manually or it will auto-run via initDB() in lib/db.js

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
    token_symbol    TEXT NOT NULL,
    token_address   TEXT,
    reason          TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cooldowns_discord_id_idx ON cooldowns(discord_id);
CREATE INDEX IF NOT EXISTS job_history_discord_id_idx ON job_history(discord_id);
CREATE INDEX IF NOT EXISTS wallets_address_idx ON wallets(address);
CREATE INDEX IF NOT EXISTS payment_links_creator_idx ON payment_links(creator_id);
