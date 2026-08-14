import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';

const superdoc = new SuperDoc({
  selector: '#editor',
  document: '/contract.docx',
  proofing: {
    enabled: true,
    provider: {
      id: 'local-example',
      check: async ({ segments }) => ({
        issues: segments.flatMap((segment) => {
          const start = segment.text.indexOf('teh');
          return start < 0
            ? []
            : [{ segmentId: segment.id, start, end: start + 3, kind: 'spelling', replacements: ['the'] }];
        }),
      }),
    },
  },
});

window.addEventListener('beforeunload', () => superdoc.destroy());
