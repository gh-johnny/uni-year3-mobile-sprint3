// API de mentira para a outbox do Pitlane (só para demonstrar o sync fora do gateway simulado).
//
//   POST /sync/events   corpo { events: [{ id, type, payload, createdAt }] } → 200 { accepted, duplicates }
//   GET  /events        lista tudo que foi recebido (deduplicado por id)
//   GET  /health        200 "ok"
//
// Contrato espelha `HttpRemoteGateway` (src/infrastructure/sync/remote-gateways.ts):
// envio idempotente por `event.id` e `Authorization: Bearer <jwt>` (apenas logado, não validado).
//
// Variáveis: PORT (4000) · FAIL_RATE 0..1 (0) força 503 para exibir retry/backoff no Sync Center.
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 4000);
const FAIL_RATE = Number(process.env.FAIL_RATE ?? 0);
const received = new Map();

const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error('payload too large'));
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });

const server = createServer(async (req, res) => {
  const { method, url } = req;

  if (method === 'GET' && url === '/health') return send(res, 200, 'ok', 'text/plain');
  if (method === 'GET' && url === '/events') return send(res, 200, { count: received.size, events: [...received.values()] });

  if (method === 'POST' && url === '/sync/events') {
    if (Math.random() < FAIL_RATE) return send(res, 503, { error: 'simulated 503' });
    try {
      const { events } = JSON.parse(await readBody(req));
      if (!Array.isArray(events)) return send(res, 400, { error: '`events` must be an array' });
      let duplicates = 0;
      for (const event of events) {
        if (received.has(event.id)) duplicates += 1;
        else received.set(event.id, { ...event, receivedAt: new Date().toISOString() });
      }
      const auth = req.headers.authorization ? 'bearer' : 'anon';
      console.log(`[sync] ${events.length} event(s) (${duplicates} duplicate) auth=${auth}: ${events.map((e) => e.type).join(', ')}`);
      return send(res, 200, { accepted: events.length - duplicates, duplicates });
    } catch (error) {
      return send(res, 400, { error: String(error.message ?? error) });
    }
  }

  return send(res, 404, { error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => console.log(`[mock-api] listening on :${PORT} (FAIL_RATE=${FAIL_RATE})`));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
