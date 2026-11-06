FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.server.json ./
COPY server ./server
# Motor do app para o site completo (server/engine + o codigo do app).
COPY electron/main ./electron/main
COPY src/shared ./src/shared
COPY scripts/engine ./scripts/engine
RUN npm run build:server && node scripts/engine/build-engine.mjs

FROM node:22-bookworm-slim AS prod-deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/dist-engine ./dist-engine
COPY server/migrations ./dist-server/server/migrations
COPY public ./public
CMD ["node", "dist-server/server/src/index.js"]
