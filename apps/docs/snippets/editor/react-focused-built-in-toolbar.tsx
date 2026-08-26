import { useRef, useState } from 'react';
import { SuperDocEditor, type SuperDocRef, type ToolbarConfig } from '@superdoc/react';
import '@superdoc/react/style.css';

const toolbar = {
  items: {
    left: ['undo', 'redo'],
    center: ['bold', 'italic', 'underline', 'link'],
    right: ['document-mode', 'zoom'],
  },
  responsiveTo: 'container',
} satisfies ToolbarConfig;

export default function App() {
  const editorRef = useRef<SuperDocRef>(null);
  const exportingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function exportDocument() {
    if (exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    try {
      await editorRef.current?.getInstance()?.export({ exportType: ['docx'], exportedName: 'sample-edited' });
    } catch (error) {
      console.error('SuperDoc could not export the document.', error);
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  }

  return (
    <main>
      <button disabled={!ready || exporting} onClick={() => void exportDocument()} type='button'>
        Export DOCX
      </button>
      <SuperDocEditor
        document='/sample.docx'
        onContentError={({ error }) => console.error('SuperDoc could not open the document.', error)}
        onException={({ error }) => console.error('SuperDoc could not open the document.', error)}
        onReady={() => setReady(true)}
        ref={editorRef}
        ui={{ toolbar }}
      />
    </main>
  );
}
