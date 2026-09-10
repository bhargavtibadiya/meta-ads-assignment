# Q: why bookworm-slim not alpine? A: Prisma 8's postgres engine is more reliable on glibc
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# [WHY] tsc only emits .js; the status page must be copied next to dist/modules.
# contract.json is copied from the repo — emit needs DATABASE_URL, which is runtime-only.
RUN npm run build \
  && mkdir -p dist/resources \
  && cp src/resources/status.html dist/resources/status.html

EXPOSE 4000

RUN chmod +x scripts/docker-entrypoint.sh

CMD ["./scripts/docker-entrypoint.sh"]
