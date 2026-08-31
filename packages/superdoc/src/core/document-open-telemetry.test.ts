import { describe, expect, it, vi } from 'vite-plus/test';
import { COMMUNITY_LICENSE_KEY } from '@superdoc/common';
import {
  createDocumentOpenTelemetry,
  createDocumentOpenTelemetryTracker,
  resolveDocumentOpenTelemetryConfig,
} from './document-open-telemetry.js';

describe('document-open telemetry', () => {
  it('stays disabled when telemetry is disabled', () => {
    expect(resolveDocumentOpenTelemetryConfig({ telemetry: { enabled: false } })).toBeNull();
  });

  it('treats telemetry: null as disabled for JavaScript consumers', () => {
    expect(resolveDocumentOpenTelemetryConfig({ telemetry: null as never })).toBeNull();
  });

  it('keeps the default enabled when a JavaScript config only customizes telemetry fields', () => {
    const metadata = { application: 'contract-review' };

    expect(
      resolveDocumentOpenTelemetryConfig({
        telemetry: {
          endpoint: 'https://telemetry.example.com/events',
          metadata,
        } as never,
      }),
    ).toEqual({
      enabled: true,
      endpoint: 'https://telemetry.example.com/events',
      metadata,
      licenseKey: COMMUNITY_LICENSE_KEY,
    });
  });

  it('uses the root license key with the configured endpoint and metadata', () => {
    const metadata = { application: 'contract-review' };

    expect(
      resolveDocumentOpenTelemetryConfig({
        licenseKey: 'root-license',
        telemetry: {
          enabled: true,
          endpoint: 'https://telemetry.example.com/events',
          metadata,
          licenseKey: 'nested-license',
        },
      }),
    ).toEqual({
      enabled: true,
      endpoint: 'https://telemetry.example.com/events',
      metadata,
      licenseKey: 'root-license',
    });
  });

  it('keeps the nested license key as a compatibility fallback', () => {
    expect(
      resolveDocumentOpenTelemetryConfig({ telemetry: { enabled: true, licenseKey: 'nested-license' } }),
    ).toMatchObject({ licenseKey: 'nested-license' });
  });

  it('preserves an explicitly null root key instead of using the compatibility key', () => {
    expect(
      resolveDocumentOpenTelemetryConfig({
        licenseKey: null as never,
        telemetry: { enabled: true, licenseKey: 'nested-license' },
      }),
    ).toMatchObject({ licenseKey: null });
  });

  it('uses the community license identity when no key is configured', () => {
    expect(resolveDocumentOpenTelemetryConfig({ telemetry: { enabled: true } })).toMatchObject({
      licenseKey: COMMUNITY_LICENSE_KEY,
    });
  });

  it('creates telemetry when it is enabled in a test environment', () => {
    expect(createDocumentOpenTelemetry({ telemetry: { enabled: true } })).not.toBeNull();
  });

  it('tracks each mounted document once', () => {
    const trackDocumentOpen = vi.fn();
    const tracker = createDocumentOpenTelemetryTracker({ trackDocumentOpen });
    const document1Open = {};
    const document2Open = {};

    tracker.trackDocumentOpen(document1Open, 'document-1');
    tracker.trackDocumentOpen(document1Open, 'document-1');
    tracker.trackDocumentOpen(document2Open, 'document-2', '2026-08-28T12:00:00Z');

    expect(trackDocumentOpen).toHaveBeenCalledTimes(2);
    expect(trackDocumentOpen).toHaveBeenNthCalledWith(1, 'document-1', null);
    expect(trackDocumentOpen).toHaveBeenNthCalledWith(2, 'document-2', '2026-08-28T12:00:00Z');
  });

  it('tracks distinct anonymous document opens', () => {
    const trackDocumentOpen = vi.fn();
    const tracker = createDocumentOpenTelemetryTracker({ trackDocumentOpen });

    tracker.trackDocumentOpen({}, null);
    tracker.trackDocumentOpen({}, null);

    expect(trackDocumentOpen).toHaveBeenCalledTimes(2);
  });

  it('tracks a replacement that keeps the same document id', () => {
    const trackDocumentOpen = vi.fn();
    const tracker = createDocumentOpenTelemetryTracker({ trackDocumentOpen });

    tracker.trackDocumentOpen({}, 'document-1');
    tracker.trackDocumentOpen({}, 'document-1');

    expect(trackDocumentOpen).toHaveBeenCalledTimes(2);
  });

  it('tracks ready events from an integration without open tokens', () => {
    const trackDocumentOpen = vi.fn();
    const tracker = createDocumentOpenTelemetryTracker({ trackDocumentOpen });

    tracker.trackDocumentOpen(null, 'document-1');
    tracker.trackDocumentOpen(null, 'document-1');

    expect(trackDocumentOpen).toHaveBeenCalledTimes(2);
  });
});
