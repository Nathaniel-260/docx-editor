import { SuperDocEditor, type SuperDocEditorProps } from '@superdoc/react';
import '@superdoc/react/style.css';

const editorProps = {
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
} satisfies SuperDocEditorProps;

export function Editor() {
  return <SuperDocEditor {...editorProps} />;
}
