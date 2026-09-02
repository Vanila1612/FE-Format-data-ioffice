FROM node:22
WORKDIR /app

COPY package.json package-lock.json* pnpm-workspace.yaml ./
COPY backend/package.json backend/package.json
COPY backend backend

RUN npm config set strict-ssl false
RUN npm install --loglevel verbose
RUN NODE_TLS_REJECT_UNAUTHORIZED=0 npx prisma generate --schema backend/prisma/schema.prisma && npx tsc -p backend/tsconfig.json

ENV NODE_ENV=production

WORKDIR /app/backend
EXPOSE 3001
CMD ["node", "dist/src/server.js"]
