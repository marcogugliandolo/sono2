# SOÑO · imagen de la web (funciona en x86 y en ARM, p. ej. Raspberry Pi)
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data \
    TZ=Europe/Madrid

RUN apk add --no-cache tzdata

WORKDIR /app

COPY --chown=node:node package.json server.js datos-iniciales.json ./
COPY --chown=node:node public ./public

RUN mkdir -p /app/data/fotos && chown -R node:node /app/data

USER node

EXPOSE 3000
VOLUME ["/app/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/salud').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
