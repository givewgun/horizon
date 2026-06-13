// Prometheus metrics for Horizon (Fastify): RED via request hooks, Node runtime
// defaults, plus domain counters (sqlite, upstream proxy calls). Exposes /metrics.
import client from 'prom-client';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

const SERVICE = process.env.OTEL_SERVICE_NAME ?? 'horizon';

export const register = client.register;
register.setDefaultLabels({ service: SERVICE });
client.collectDefaultMetrics();

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['service', 'method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
});

// Domain metrics (record from the relevant call sites as the app grows).
export const sqliteQueries = new client.Counter({
  name: 'horizon_sqlite_queries_total',
  help: 'SQLite queries executed',
  labelNames: ['op'],
});
export const upstreamRequests = new client.Counter({
  name: 'horizon_upstream_requests_total',
  help: 'Outbound upstream API calls',
  labelNames: ['upstream', 'outcome'],
});
export const upstreamDuration = new client.Histogram({
  name: 'horizon_upstream_request_duration_seconds',
  help: 'Outbound upstream API latency',
  labelNames: ['upstream'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
});

const endByRequest = new WeakMap<FastifyRequest, ReturnType<typeof httpDuration.startTimer>>();

export async function registerMetrics(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (req: FastifyRequest): Promise<void> => {
    if (req.url === '/metrics') return;
    endByRequest.set(req, httpDuration.startTimer());
  });

  app.addHook('onResponse', async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const end = endByRequest.get(req);
    if (!end) return;
    const route = req.routeOptions?.url ?? 'other';
    end({ service: SERVICE, method: req.method, route, status_code: reply.statusCode });
  });

  app.get('/metrics', async (_req: FastifyRequest, reply: FastifyReply): Promise<string> => {
    void reply.header('Content-Type', register.contentType);
    return register.metrics();
  });
}
