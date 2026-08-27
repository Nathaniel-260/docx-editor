import { ConfigExplorer } from './config-explorer';
import { loadingConfigExplorer } from '@/lib/loading-config-explorer';

export function LoadingConfigReference() {
  return <ConfigExplorer data={loadingConfigExplorer} initialField='loading' />;
}
