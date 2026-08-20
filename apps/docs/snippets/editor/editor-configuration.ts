import { SuperDoc, type Config } from 'superdoc';
import 'superdoc/style.css';

const config = {
  selector: '#editor',
  document: '/sample.docx',
  user: {
    name: 'Jordan Lee',
    email: 'jordan@example.com',
  },
  onReady: () => {
    console.info('SuperDoc is ready.');
  },
  onContentError: ({ error }) => {
    console.error('SuperDoc could not read the document.', error);
  },
  onException: ({ error }) => {
    console.error('SuperDoc could not start.', error);
  },
} satisfies Config;

const superdoc = new SuperDoc(config);

window.addEventListener('beforeunload', () => superdoc.destroy());
