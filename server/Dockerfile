FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.server.json ./
COPY server ./server
COPY electron/main/services/chargeDocuments.ts ./electron/main/services/chargeDocuments.ts
COPY src/shared ./src/shared
RUN npm run build:server

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist-server ./dist-server
COPY server/migrations ./dist-server/server/migrations
COPY public ./public
CMD ["node", "dist-server/server/src/index.js"]
