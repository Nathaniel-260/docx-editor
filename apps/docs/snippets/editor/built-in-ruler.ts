import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';

const superdoc = new SuperDoc({
  selector: '#editor',
  document: '/sample.docx',
  ui: {
    ruler: true,
  },
  measurementUnit: 'in',
});

window.addEventListener('beforeunload', () => superdoc.destroy());
