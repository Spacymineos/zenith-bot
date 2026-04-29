FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Set permissions
RUN addgroup -S zenith && adduser -S zenith -G zenith
RUN chown -R zenith:zenith /app
USER zenith

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD node -e "process.exit(0)"

CMD ["npm", "run", "start"]
