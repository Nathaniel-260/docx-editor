import { ConfigExplorer } from './config-explorer';
import { contextMenuConfigExplorer } from '@/lib/context-menu-config-explorer';

export function ContextMenuConfigReference() {
  return <ConfigExplorer data={contextMenuConfigExplorer} initialField='sections' />;
}
