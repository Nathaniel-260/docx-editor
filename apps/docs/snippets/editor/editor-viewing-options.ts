import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';

const superdoc = new SuperDoc({
  selector: '#editor',
  document: '/sample.docx',
  documentMode: 'viewing',
  viewing: {
    comments: true,
    trackedChanges: 'markup',
  },
});

window.addEventListener('beforeunload', () => superdoc.destroy());
