FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/lookups/package.json packages/lookups/package.json
RUN npm ci --workspace=apps/api --include-workspace-root
COPY apps/api apps/api
RUN npm run build --workspace=apps/api
WORKDIR /app/apps/api
CMD ["node", "dist/server.js"]
