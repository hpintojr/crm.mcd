import "server-only";

type RouteTraceMetadata = Record<string, boolean | number | string | null | undefined>;

function routeTracingEnabled() {
  return process.env.ROUTE_TRACE_ENABLED?.trim().toLowerCase() === "true";
}

export function routeTrace(event: string, metadata?: RouteTraceMetadata) {
  if (!routeTracingEnabled()) return;
  if (metadata) {
    console.info("[route-trace]", event, metadata);
    return;
  }
  console.info("[route-trace]", event);
}
