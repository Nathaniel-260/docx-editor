import { SuperDocEditor, type SuperDocEditorProps } from '@superdoc/react';
import '@superdoc/react/style.css';

const editorConfig = {
  ui: {
    ruler: true,
  },
  measurementUnit: 'in',
} satisfies Pick<SuperDocEditorProps, 'ui' | 'measurementUnit'>;

export default function App() {
  return <SuperDocEditor document='/sample.docx' {...editorConfig} />;
}
