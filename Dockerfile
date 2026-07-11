# ==========================
# Stage 1: Build
# ==========================
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time, so
# they must be passed in as a build arg (see docker-compose.yml) rather
# than only being in the runtime .env.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN npm run build

# ==========================
# Stage 2: Production
# ==========================
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.* ./
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["npm", "start"]
