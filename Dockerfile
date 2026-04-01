FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production
RUN npx prisma generate

COPY src ./src

RUN addgroup -S diagconnect && adduser -S diagserver -G diagconnect
RUN chown -R diagserver:diagconnect /app
USER diagserver

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health',(r)=>process.exit(r.statusCode===200?0:1))"

CMD ["node", "src/server.js"]
