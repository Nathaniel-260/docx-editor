import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';

const superdoc = new SuperDoc({
  selector: '#editor',
  document: '/sample.docx',
  documentMode: 'suggesting',
});

export function switchToViewing() {
  superdoc.setDocumentMode('viewing');
}

window.addEventListener('beforeunload', () => superdoc.destroy());
