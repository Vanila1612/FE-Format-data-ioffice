FROM node:22-alpine AS deps
WORKDIR /app
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
RUN pnpm config set fetch-timeout 600000 \
 && pnpm config set fetch-retries 10 \
 && pnpm config set dangerouslyAllowAllBuilds true \
 && pnpm install --frozen-lockfile \
      --config.only-built-dependencies=esbuild \
      --config.only-built-dependencies=prisma \
      --config.only-built-dependencies=@prisma/client \
      --config.only-built-dependencies=@prisma/engines

FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend ./backend
WORKDIR /app/backend
RUN pnpm config set verify-deps-before-run false && pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/node_modules ./backend/node_modules
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/backend/prisma ./backend/prisma
WORKDIR /app/backend
EXPOSE 3001
CMD ["sh", "-c", "pnpm config set verify-deps-before-run false && pnpm prisma:push && pnpm seed && node dist/src/server.js"]
