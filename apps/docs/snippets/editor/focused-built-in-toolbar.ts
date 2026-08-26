import { SuperDoc, type ToolbarConfig } from 'superdoc';
import 'superdoc/style.css';

const toolbar = {
  container: '#toolbar',
  items: {
    left: ['undo', 'redo'],
    center: ['bold', 'italic', 'underline', 'link'],
    right: ['document-mode', 'zoom'],
  },
  responsiveTo: 'container',
} satisfies ToolbarConfig;

const superdoc = new SuperDoc({
  selector: '#editor',
  document: '/sample.docx',
  ui: { toolbar },
});
