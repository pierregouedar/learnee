FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/* \
  && npm i -g pnpm@11
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS run
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg tzdata && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 DATABASE_PATH=/data/app.db DATA_DIR=/data TZ=Europe/Paris
COPY --from=build /app/.next/standalone ./
# Le bundle standalone ne garde better-sqlite3 que sous node_modules/.pnpm/... (pas d'alias racine) :
# scripts/user-add.mjs, qui tourne hors du bundle Next, ne le trouverait pas sans ce lien.
RUN ln -s "$(ls -d node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 | head -1 | sed 's#^node_modules/##')" node_modules/better-sqlite3
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/scripts ./scripts
# Sans root : ffmpeg lit des fichiers envoyés. /data doit appartenir à l'uid 1000 (voir README, Déploiement).
RUN mkdir -p /data && chown -R node:node /app /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "server.js"]
