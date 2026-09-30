FROM node:22
WORKDIR /app
ENV NODE_ENV=production

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy workspace manifest & package files for dependency install
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json

# Install all dependencies (incl. devDeps needed to build)
RUN pnpm install --frozen-lockfile

# Copy source & build
COPY backend backend
RUN pnpm --filter backend build

WORKDIR /app/backend
EXPOSE 3001
CMD ["node", "dist/src/server.js"]
