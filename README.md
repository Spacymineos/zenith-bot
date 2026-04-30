<div align="center">

![Deprecated](https://img.shields.io/badge/Status-Archived-red?style=for-the-badge&logo=archive&logoColor=yellow)

# 🚨 SPACYMINOS DEPRECATED 🚨

**Project archived. No longer maintained.**

</div>
# 🌌 Zenith Protocol

The ultimate decentralized economy platform on the Zenith EVM Chain (ID: 13371). A "worth millions" repository designed for scalability, security, and ease of use.

## 🚀 Overview

Zenith is a multi-faceted Discord-integrated blockchain platform featuring:
- **Synthetic Assets**: sUSD, sBTC, sGOLD, and more via `VaultManager`.
- **DEX**: Full Uniswap V2 fork for swapping and liquidity.
- **Mining**: Proof-of-Work style hashrate leaderboard and rewards.
- **Economy**: Daily claims, work rewards, gambling, and a dynamic shop.
- **Smart Contracts**: Robust Solidity suite with Hardhat testing.
- **Database**: Type-safe Prisma ORM with high-performance PG adapters.

---

## 🛠️ Tech Stack

- **Engine**: [Node.js v20+](https://nodejs.org/)
- **Blockchain**: [Ethers.js v6](https://docs.ethers.org/v6/)
- **ORM**: [Prisma v7](https://www.prisma.io/)
- **Framework**: [Discord.js v14](https://discord.js.org/)
- **Smart Contracts**: [Solidity 0.8.24](https://soliditylang.org/) / [Hardhat](https://hardhat.org/)
- **Deployment**: Docker, PM2, Nginx

---

## 🏗️ Getting Started

### 1. Prerequisites
- Docker & Docker Compose
- Node.js installed locally (for development)
- A Discord Bot Token ([Discord Developer Portal](https://discord.com/developers/applications))

### 2. Deployment
```bash
cp .env.example .env
# Fill in your .env with Discord Token and Keys.

# ONE COMMAND TO RULE THEM ALL:
# This starts the Database, Geth node, Migrates DB, and Launches the Bot.
npm run launch
```

---

## 📁 Repository Structure

- `src/` — Core TypeScript application logic.
  - `commands/` — All Discord slash command implementations.
  - `config.ts` — **Centralized configuration** (Branding, ENV, ABIs).
  - `core.ts` — Database, Blockchain, and Discord utilities.
- `contracts/` — Solidity smart contracts and deployment scripts.
- `prisma/` — Database schema and migrations.
- `deploy/` — Infrastructure configuration (Nginx, etc.).
- `tests/` — Comprehensive test suite for the bot.

---

## 🔧 Modification Guide

Everything is designed to be easily modified in `src/config.ts`:
- **Change Branding**: Update `BRAND.COLOR` and `BRAND.NAME`.
- **Add Tokens**: Update `CONTRACT_ADDRESSES` and `ABIS`.
- **Tune Cooldowns**: Modify command logic in `src/commands/`.

---

## 📜 License

Proprietary. All rights reserved.
