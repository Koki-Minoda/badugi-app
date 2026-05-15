import { computeCoachingEngagementMetrics } from "./metrics.js";

export function buildTelemetryPreviewInspector({ events = [] } = {}) {
  return {
    previewOnly: true,
    backendUpload: false,
    hiddenTelemetry: false,
    eventCount: events.length,
    events,
    metrics: computeCoachingEngagementMetrics(events),
    exportJson: JSON.stringify({ previewOnly: true, events }, null, 2),
  };
}
