import { ConfigExplorer } from './config-explorer';
import { proofingConfigExplorer } from '@/lib/proofing-config-explorer';

export function ProofingConfigReference() {
  return <ConfigExplorer data={proofingConfigExplorer} initialField='enabled' />;
}
