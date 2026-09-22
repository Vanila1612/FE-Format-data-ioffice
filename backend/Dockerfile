FROM node:22
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY backend/dist backend/dist
COPY node_modules node_modules
COPY backend/node_modules backend/node_modules

WORKDIR /app/backend
EXPOSE 3001
CMD ["node", "dist/src/server.js"]
