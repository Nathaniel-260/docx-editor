import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';

let ready = false;

const superdoc = new SuperDoc({
  selector: '#editor',
  document: '/sample.docx',
  documentMode: 'suggesting',
  viewing: {
    comments: true,
    trackedChanges: 'markup',
  },
  onReady: () => {
    ready = true;
  },
});

export function switchToViewing() {
  if (!ready) return;
  superdoc.setDocumentMode('viewing');
}

window.addEventListener('beforeunload', () => superdoc.destroy());
