import { ConfigExplorer } from './config-explorer';
import { rulerConfigExplorer } from '@/lib/ruler-config-explorer';

export function RulerConfigReference() {
  return <ConfigExplorer data={rulerConfigExplorer} initialField='ruler' />;
}
