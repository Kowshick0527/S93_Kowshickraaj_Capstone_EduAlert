FROM node:22-alpine

ENV NODE_ENV=production

WORKDIR /app

COPY server/package*.json ./server/
RUN npm ci --omit=dev --prefix server && npm cache clean --force

COPY --chown=node:node server/ ./server/
RUN mkdir -p /app/server/uploads && chown -R node:node /app/server

USER node

EXPOSE 5000

CMD ["npm", "start", "--prefix", "server"]
