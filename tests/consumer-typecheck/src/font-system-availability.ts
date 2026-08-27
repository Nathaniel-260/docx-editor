/** Consumer typecheck: system-font availability is visible on font report rows. */
import type { SuperDoc } from 'superdoc';

type GetReport = SuperDoc['fonts']['getReport'];

const getReportParameters: Parameters<GetReport> = [];
declare const report: ReturnType<GetReport>;

const row = report[0];
if (row) {
  const systemAvailability: 'checking' | 'available' | 'unavailable' | 'unknown' | undefined = row.systemAvailability;
  const missing: boolean = row.missing;
  void [systemAvailability, missing];
}

void getReportParameters;
