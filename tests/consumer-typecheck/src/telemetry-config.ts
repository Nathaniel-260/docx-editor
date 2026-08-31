import type { Config, SuperDocTelemetryConfig } from 'superdoc';

const telemetry = {
  enabled: true,
  endpoint: 'https://telemetry.example.com/events',
  metadata: {
    application: 'contract-review',
    environment: 'production',
  },
} satisfies SuperDocTelemetryConfig;

const _config: Config = {
  selector: '#editor',
  licenseKey: 'license-key',
  telemetry,
};

const _disabled: SuperDocTelemetryConfig = { enabled: false };

const _invalidMetadata: SuperDocTelemetryConfig = {
  enabled: true,
  // @ts-expect-error metadata must be an object keyed by strings
  metadata: 'production',
};

// The deprecated nested key remains typed until v3. New integrations use Config.licenseKey.
const _nestedLicenseKey: SuperDocTelemetryConfig = { enabled: true, licenseKey: 'license-key' };

void [_config, _disabled, _invalidMetadata, _nestedLicenseKey];
