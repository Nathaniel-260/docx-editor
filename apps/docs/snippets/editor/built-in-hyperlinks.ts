import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';
import { handleHyperlinkActivation } from './hyperlink-activation';

const superdoc = new SuperDoc({
  selector: '#editor',
  document: '/sample.docx',
  hyperlinks: {
    onActivate: handleHyperlinkActivation,
  },
  ui: {
    toolbar: { container: '#toolbar', groups: { center: ['link'] } },
  },
});

window.addEventListener('beforeunload', () => superdoc.destroy());
