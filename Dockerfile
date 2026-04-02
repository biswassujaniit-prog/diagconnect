FROM node:20-alpine AS client-build
WORKDIR /build
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
# Vite config outputs to ../src/public (relative to client dir)
# In Docker, that becomes /src/public
RUN npx vite build --outDir /build/dist

FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache openssl
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production
RUN npx prisma generate
COPY src ./src
# Copy the built frontend into Express static directory
COPY --from=client-build /build/dist ./src/public
EXPOSE 4000
CMD ["node", "src/server.js"]
