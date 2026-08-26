import { ConfigExplorer } from './config-explorer';
import { hyperlinksConfigExplorer } from '@/lib/hyperlinks-config-explorer';

export function HyperlinksConfigReference() {
  return <ConfigExplorer data={hyperlinksConfigExplorer} initialField='onActivate' />;
}
