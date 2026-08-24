FROM node:22-alpine AS deps
WORKDIR /app
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json frontend/package.json
RUN pnpm config set fetch-timeout 600000 \
 && pnpm config set fetch-retries 10 \
 && pnpm config set dangerouslyAllowAllBuilds true \
 && pnpm install --frozen-lockfile --config.only-built-dependencies=esbuild

FROM node:22-alpine AS build
WORKDIR /app
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
RUN corepack enable && corepack prepare pnpm@11.16.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend ./frontend
WORKDIR /app/frontend
ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN pnpm config set verify-deps-before-run false && pnpm build

FROM nginx:1.27-alpine AS runtime
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
