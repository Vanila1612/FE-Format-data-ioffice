FROM node:22 AS build
WORKDIR /app

COPY package.json package-lock.json* pnpm-workspace.yaml ./
COPY frontend/package.json frontend/package.json
COPY frontend frontend

RUN npm config set strict-ssl false
RUN npm install --loglevel verbose
RUN npm run build --workspace=@ioffice/frontend

FROM nginx:stable-alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
