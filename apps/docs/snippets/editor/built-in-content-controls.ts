import { SuperDoc } from 'superdoc';
import 'superdoc/style.css';

const status = document.querySelector<HTMLOutputElement>('#content-control-status');

const superdoc = new SuperDoc({
  selector: '#editor',
  document: '/content-controls-sample.docx',
  ui: {
    contentControls: true,
  },
  onContentControlClick: ({ target }) => {
    if (!status) return;

    const name = target.alias ?? target.tag ?? target.id;
    status.value = `${name} · tag: ${target.tag ?? 'none'} · type: ${target.controlType}`;
  },
});

window.addEventListener('beforeunload', () => superdoc.destroy());
