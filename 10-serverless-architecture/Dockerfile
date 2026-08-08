FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig*.json ./
COPY functions ./functions
COPY runtime ./runtime
COPY triggers ./triggers
COPY store ./store
COPY main.ts ./
RUN npm run build

FROM node:20-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

USER app

EXPOSE 3010

CMD ["node", "dist/main.js"]
