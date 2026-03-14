FROM node:22-alpine AS builder

WORKDIR /app

COPY sdk/package.json sdk/package-lock.json ./sdk/
RUN cd sdk && npm ci

COPY sdk/ ./sdk/
RUN cd sdk && npm run build

COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm ci

COPY backend/ ./backend/
RUN cd backend && npm run build

FROM node:22-alpine

WORKDIR /app

RUN addgroup -S sss && adduser -S sss -G sss

COPY --from=builder /app/sdk/package.json /app/sdk/
COPY --from=builder /app/sdk/dist /app/sdk/dist/
COPY --from=builder /app/sdk/node_modules /app/sdk/node_modules/

COPY --from=builder /app/backend/package.json /app/backend/
COPY --from=builder /app/backend/dist /app/backend/dist/
COPY --from=builder /app/backend/node_modules /app/backend/node_modules/

USER sss

EXPOSE 3000

WORKDIR /app/backend

CMD ["node", "dist/main.js"]
