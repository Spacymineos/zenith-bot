FROM node:20-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/bot/package.json ./apps/bot/
COPY packages/shared/package.json ./packages/shared/
COPY packages/config/package.json ./packages/config/

RUN pnpm install --frozen-lockfile

COPY apps/bot ./apps/bot
COPY packages/shared ./packages/shared
COPY packages/config ./packages/config
COPY packages/contracts/deployments.json ./packages/contracts/deployments.json
COPY packages/contracts/abis ./packages/contracts/abis

RUN pnpm --filter @chainbot/config build && pnpm --filter @chainbot/shared build

WORKDIR /app/apps/bot
CMD ["node_modules/.bin/tsx", "src/index.ts"]
