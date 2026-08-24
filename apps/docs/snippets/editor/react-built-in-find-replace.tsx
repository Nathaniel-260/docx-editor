import { SuperDocEditor, type SuperDocEditorProps } from '@superdoc/react';
import '@superdoc/react/style.css';

const editorConfig = {
  ui: {
    search: true,
  },
} satisfies Pick<SuperDocEditorProps, 'ui'>;

export default function App() {
  return <SuperDocEditor document='/sample.docx' ui={editorConfig.ui} />;
}
