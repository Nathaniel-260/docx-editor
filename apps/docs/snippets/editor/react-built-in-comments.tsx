import { SuperDocEditor, type SuperDocEditorProps } from '@superdoc/react';
import '@superdoc/react/style.css';

const editorConfig = {
  user: {
    name: 'Alex Rivera',
    email: 'alex@example.com',
  },
  ui: {
    comments: {
      layout: 'auto',
    },
  },
} satisfies Pick<SuperDocEditorProps, 'user' | 'ui'>;

export default function App() {
  return <SuperDocEditor document='/sample.docx' user={editorConfig.user} ui={editorConfig.ui} />;
}
