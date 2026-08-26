import { ConfigExplorer } from './config-explorer';
import { toolbarConfigExplorer } from '@/lib/toolbar-config-explorer';

export function ToolbarConfigReference() {
  return <ConfigExplorer data={toolbarConfigExplorer} initialField='items' />;
}
