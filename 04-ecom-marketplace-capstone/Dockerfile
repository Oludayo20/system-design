# --- Build stage ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

# --- Runtime stage ---
# This single image is used for BOTH api-1 and api-2 in docker-compose.yml.
# The app is stateless (all state lives in Postgres/Redis/RabbitMQ, config
# comes entirely from env vars) - that statelessness is what makes running
# two identical replicas behind Nginx a valid horizontal-scaling move rather
# than two containers that happen to disagree with each other.
FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S oja && adduser -S oja -G oja

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER oja

EXPOSE 3000

CMD ["node", "dist/main.js"]
