import { BlankDOCX, SuperDoc } from 'superdoc';
import 'superdoc/style.css';
import { englishProofingProvider } from './english-proofing-provider';

const superdoc = new SuperDoc({
  selector: '#editor',
  document: BlankDOCX,
  proofing: {
    enabled: true,
    provider: englishProofingProvider,
  },
  // Seed the blank document so proofing is visible immediately.
  onReady: ({ superdoc: readySuperDoc }) => {
    void readySuperDoc.activeEditor?.doc?.insert({ value: 'don’t mispelled' });
  },
});

window.addEventListener('beforeunload', () => superdoc.destroy());
