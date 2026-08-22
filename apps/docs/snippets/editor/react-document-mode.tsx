import { useState } from 'react';
import { SuperDocEditor, type DocumentMode } from '@superdoc/react';
import '@superdoc/react/style.css';

export function Editor() {
  const [documentMode, setDocumentMode] = useState<DocumentMode>('suggesting');

  return (
    <>
      <button onClick={() => setDocumentMode('viewing')} type='button'>
        Switch to viewing
      </button>
      <SuperDocEditor
        document='/sample.docx'
        documentMode={documentMode}
        viewing={{
          comments: true,
          trackedChanges: 'markup',
        }}
      />
    </>
  );
}
