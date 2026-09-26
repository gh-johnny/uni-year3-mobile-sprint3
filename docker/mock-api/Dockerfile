# syntax=docker/dockerfile:1.7
# API de mentira do sync (ver server.mjs). Sem dependências: só o Node.
FROM node:22-alpine

WORKDIR /srv
COPY server.mjs ./

ENV PORT=4000 FAIL_RATE=0
EXPOSE 4000
USER 1000:1000

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD ["wget", "-qO-", "http://127.0.0.1:4000/health"]

CMD ["node", "server.mjs"]
