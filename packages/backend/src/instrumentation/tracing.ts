// OpenTelemetry bootstrap for Horizon. Loaded via `node --import .../tracing.js`
// so the SDK starts (synchronously) before Fastify is imported and can be
// auto-instrumented. Best-effort: telemetry failures must never crash the app.
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';

const url = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://oculory-alloy:4317';
const disabled = process.env.NODE_ENV === 'test' || process.env.OTEL_SDK_DISABLED === 'true';

if (!disabled) try {
  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });
  sdk.start();
  process.on('SIGTERM', () => {
    void sdk.shutdown().catch(() => undefined);
  });
} catch (err) {
  console.error('[otel] tracing disabled:', err);
}
