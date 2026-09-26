# syntax=docker/dockerfile:1.7
#
# Pitlane — imagem multi-stage (Node 22 / Expo SDK 57).
#
#   deps ──▶ source ──┬─▶ check ──▶ coverage        (docker build --target check | coverage --output)
#                     ├─▶ bundle ─▶ bundle-out      (docker build --target bundle-out --output)
#                     └─▶ dev  (padrão)             (Metro / expo start com hot reload)
#
# O build do APK/AAB *não* roda aqui de propósito: exige Android SDK + NDK (~5 GB) e é feito
# pelo EAS Build (ver README → CI/CD). Aqui ficam a verificação, o bundle JS e o servidor de dev.
#
# Uso rápido (ou `make help`):
#   docker build --target check .                    # typecheck + lint + testes + gate de cobertura
#   docker build --target bundle-out -o dist .       # bundle Hermes do Android em ./dist
#   docker build -t pitlane:dev . && docker run --rm -it -p 8081:8081 pitlane:dev

ARG NODE_VERSION=22

# ── base ──────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS base

LABEL org.opencontainers.image.title="pitlane" \
      org.opencontainers.image.description="Pitlane — app Expo/React Native (FIAP x Ford, Desafio 02: VIN/Service Share)" \
      org.opencontainers.image.source="https://github.com/" \
      org.opencontainers.image.licenses="MIT"

# git: o expo-doctor e o Metro consultam o repositório/gitignore.
RUN apt-get update \
 && apt-get install -y --no-install-recommends git ca-certificates \
 && rm -rf /var/lib/apt/lists/*

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    EXPO_NO_TELEMETRY=1 \
    TZ=America/Sao_Paulo

# /app pertence ao usuário não-root `node` (uid 1000) para o bind mount do compose funcionar.
RUN mkdir -p /app && chown node:node /app
WORKDIR /app
USER 1000:1000

# ── deps: só reinstala quando package*.json mudam ─────────────────────────────
FROM base AS deps
COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=cache,target=/home/node/.npm,uid=1000,gid=1000 \
    npm ci

# ── source: dependências + código ─────────────────────────────────────────────
FROM deps AS source
COPY --chown=node:node . .

# ── check: o mesmo gate do CI (falha o build se algo quebrar) ─────────────────
FROM source AS check
ENV CI=1
RUN npm run typecheck \
 && npm run lint \
 && npm run test:cov -- --ci

# Exporta o relatório: docker build --target coverage -o coverage .
FROM scratch AS coverage
COPY --from=check /app/coverage/ /

# ── bundle: expo export (Hermes) ──────────────────────────────────────────────
FROM source AS bundle
ENV CI=1
RUN npx expo export --platform android --output-dir /tmp/bundle

# Exporta o bundle: docker build --target bundle-out -o dist .
FROM scratch AS bundle-out
COPY --from=bundle /tmp/bundle/ /

# ── dev (padrão): Metro com hot reload ────────────────────────────────────────
FROM source AS dev
ENV NODE_ENV=development \
    EXPO_PUBLIC_APP_ENV=development \
    EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0
EXPOSE 8081

# Metro responde "packager-status:running" em /status quando está de pé.
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8081/status').then(r=>r.text()).then(t=>process.exit(t.includes('running')?0:1)).catch(()=>process.exit(1))"]

CMD ["npx", "expo", "start", "--port", "8081", "--host", "lan"]
