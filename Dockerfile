FROM node:22-alpine AS frontend-build

WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY openapi ./openapi
COPY scripts ./scripts
COPY src ./src
COPY index.html tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts vitest.config.ts ./
RUN npm run api:check && npm run build

FROM nginx:1.27-alpine
COPY --from=frontend-build /workspace/dist /usr/share/nginx/html
