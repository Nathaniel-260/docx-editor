import { COMMUNITY_LICENSE_KEY, Telemetry } from '@superdoc/common';
import type { TelemetryConfig } from '@superdoc/common';
import type { Config } from './types/index.js';

type DocumentOpenTelemetryClient = Pick<Telemetry, 'trackDocumentOpen'>;

export type DocumentOpenTelemetry = {
  trackDocumentOpen(
    documentOpenToken: object | null,
    documentId: string | null,
    documentCreatedAt?: string | null,
  ): void;
};

export function resolveDocumentOpenTelemetryConfig(
  config: Pick<Config, 'licenseKey' | 'telemetry'>,
): TelemetryConfig | null {
  const telemetry = config.telemetry;
  if (telemetry === null || telemetry?.enabled === false) return null;

  return {
    enabled: true,
    endpoint: telemetry?.endpoint,
    metadata: telemetry?.metadata,
    licenseKey: config.licenseKey !== undefined ? config.licenseKey : (telemetry?.licenseKey ?? COMMUNITY_LICENSE_KEY),
  };
}

export function createDocumentOpenTelemetryTracker(client: DocumentOpenTelemetryClient): DocumentOpenTelemetry {
  const trackedDocumentOpenTokens = new WeakSet<object>();

  return {
    trackDocumentOpen(documentOpenToken, documentId, documentCreatedAt = null) {
      if (documentOpenToken && trackedDocumentOpenTokens.has(documentOpenToken)) return;
      if (documentOpenToken) trackedDocumentOpenTokens.add(documentOpenToken);
      client.trackDocumentOpen(documentId, documentCreatedAt);
    },
  };
}

export function createDocumentOpenTelemetry(
  config: Pick<Config, 'licenseKey' | 'telemetry'>,
): DocumentOpenTelemetry | null {
  const telemetryConfig = resolveDocumentOpenTelemetryConfig(config);
  if (!telemetryConfig) return null;

  return createDocumentOpenTelemetryTracker(new Telemetry(telemetryConfig));
}
