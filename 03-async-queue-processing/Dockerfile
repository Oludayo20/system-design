# --- Build stage ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage ---
# One image, two entrypoints: dist/main.js (API/producer) and dist/worker.main.js (consumer).
# Which one runs is chosen by `command:` in docker-compose.yml, so `docker compose up
# --scale worker=20` spins up 20 containers from this same image, all running the worker
# entrypoint, independent of the single `api` container.
FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S asyncqueue && adduser -S asyncqueue -G asyncqueue

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER asyncqueue

EXPOSE 3000

CMD ["node", "dist/main.js"]
