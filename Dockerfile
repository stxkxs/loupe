# loupe — one container serves the static SPA (with its bundled catalog) and the /v1 API.
# Snapshots are committed, so the image builds with no network (deterministic).
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# runtime: production deps only (no vite/vitest/eslint/typescript) — tsx + hono + zod + mcp-sdk
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost:8787/health || exit 1
# the API server also serves ./dist (the SPA). MCP is stdio (run separately).
CMD ["npx", "tsx", "src/api/server.ts"]
