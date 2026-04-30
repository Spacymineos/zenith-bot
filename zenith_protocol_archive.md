# Zenith Protocol (Formerly ChainBot) - Archive Documentation

## 1. Overview
The **Zenith Protocol** is the ultimate decentralized economy platform built around a custom EVM-compatible blockchain. Recently rebranded from "ChainBot" to "Zenith", the project has streamlined its focus onto an integrated Discord bot ecosystem, deprecating auxiliary web applications and documentation sites to double down on the core bot functionality.

This repository encompasses a full-fledged local EVM network (Geth), a comprehensive suite of Solidity smart contracts, a PostgreSQL database, and a robust Discord bot built with Discord.js and Ethers.js.

## 2. Tech Stack
- **Engine**: Node.js (v20+)
- **Framework**: Discord.js v14
- **Blockchain**: Ethers.js v6, Hardhat
- **Smart Contracts**: Solidity 0.8.24
- **Database**: PostgreSQL 15, Prisma ORM v7 with `@prisma/adapter-pg`
- **Infrastructure**: Docker & Docker Compose (Geth, Postgres, Nginx, Node.js bot)

## 3. Network Architecture
- **Network Name**: Zenith EVM Chain
- **Chain ID**: `13371`
- **RPC Endpoint**: Local Geth node exposed at `http://geth:8545` (or mapped to localhost)
- **WS Endpoint**: `ws://geth:8546`
- **Currency**: Zenith Coin (Native) / Tokens (ERC20)

## 4. Smart Contracts Ecosystem
The `contracts/src/` directory contains a robust suite of interconnected contracts:
- **`MintController`**: Handles the daily economy, managing user claims (`claimDaily`) and work rewards (`mintWork`).
- **`MinerRegistry`**: A Proof-of-Work style system that tracks miner hashrates, ranks, and distributes block rewards based on computing power.
- **`MemeCoinFactory`**: A token generator allowing users to deploy their own custom ERC-20 tokens dynamically.
- **`PriceOracle`**: Provides pricing data for native and synthetic assets, tracking 24-hour changes.
- **Uniswap V2 Fork**: 
  - Includes `UniswapV2Router` and `UniswapV2Factory` for permissionless liquidity provisioning and token swapping.
- **`VaultManager`**: A synthetic asset generator (like MakerDAO) allowing users to deposit collateral and mint stablecoins (e.g., sUSD) against it.
- **`NFTCollection`**: A fully functional on-chain shop and inventory system where users can purchase items with the native currency.

## 5. Application Core (`src/`)
The TypeScript bot logic handles direct interaction with the blockchain and database:
- **`config.ts`**: The central source of truth for the project. It exports `ENV` variables, `BRAND` assets, `CONTRACT_ADDRESSES`, and `ABIS` mapping to typed `ZenithContracts` interfaces.
- **`core.ts`**: Contains database initializations, caching mechanisms, Ethers.js `JsonRpcProvider` setup (using a static `Network` object to prevent polling issues), wallet encryption/decryption (AES-256-GCM), and reusable Discord Embed builders (`success`, `error`, `warning`).
- **`commands/`**: Contains all 19 functional Discord slash commands.

### Discord Commands List
- `balance`: Check native and ERC-20 token balances.
- `daily`: Claim a daily native token reward.
- `gamble`: A probabilistic mini-game.
- `hashrate`: Check a user's mining power.
- `help`: Dynamic help menu.
- `inventory`: View purchased NFT shop items.
- `leaderboard`: Global rankings.
- `liquidity`: Manage Uniswap pool liquidity.
- `miner`: Interface for the `MinerRegistry`.
- `nodes`: Information about network nodes.
- `pay` & `send`: Transfer tokens between users.
- `price`: Fetch asset prices from the `PriceOracle`.
- `shop`: Buy NFTs/Items via the `NFTCollection`.
- `swap`: Trade tokens using the Uniswap Router.
- `token`: Deploy new tokens via the `MemeCoinFactory`.
- `vault`: Manage CDPs (Collateralized Debt Positions) in the `VaultManager`.
- `wallet`: Link, create, or export custodial and non-custodial wallets.
- `work`: Perform a task to earn a small reward.

## 6. Database Schema (`prisma/schema.prisma`)
The PostgreSQL database handles state that shouldn't be fully on-chain or needs fast indexing:
- **`Wallet`**: Maps `discord_id` to an Ethereum `address`. Stores symmetrically encrypted private keys for custodial wallets.
- **`Cooldown`**: Tracks command usage per Discord ID to enforce rate-limiting.
- **`TokenRegistry`**: An off-chain index of tokens created via the `MemeCoinFactory`.
- **`PaymentLink`**: Manages generated pay requests.

## 7. Infrastructure (`docker-compose.yml`)
The whole stack can be spun up using `npm run launch` or `docker compose up -d`.
Services included:
- **`geth`**: Custom `ethereum/client-go` node initialized with `genesis.json`.
- **`postgres`**: PostgreSQL 15 database instance.
- **`bot`**: The Node.js worker running the Discord bot, which automatically runs `npx prisma db push --accept-data-loss` on startup.
- **`nginx`**: Reverse proxy for routing requests if external access is needed.

## 8. Development & Deployment
- The bot configuration uses `.env` for secrets like `DISCORD_TOKEN`, `BOT_WALLET_PRIVATE_KEY` (Treasury), and `ENCRYPTION_KEY`.
- Commands can be registered to Discord using the `npm run deploy` script.
- Extensive test coverage is set up with `vitest` for the TS layer and `hardhat test` for the smart contracts.
