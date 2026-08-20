import { ConfigExplorer } from './config-explorer';
import { editorConfigExplorer } from '@/lib/editor-config-explorer';

export function ConfigReference() {
  return <ConfigExplorer data={editorConfigExplorer} initialField='selector' />;
}
