import { ConfigExplorer } from './config-explorer';
import { searchConfigExplorer } from '@/lib/search-config-explorer';

export function SearchConfigReference() {
  return <ConfigExplorer data={searchConfigExplorer} initialField='replaceControls' />;
}
