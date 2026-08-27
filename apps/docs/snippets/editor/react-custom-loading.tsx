'use client';

import { SuperDocEditor } from '@superdoc/react';
import '@superdoc/react/style.css';
import { useState } from 'react';

export default function App() {
  const [loadFailed, setLoadFailed] = useState(false);

  return (
    <SuperDocEditor
      document='/contract.docx'
      renderLoading={() =>
        loadFailed ? <p role='alert'>Could not open the document.</p> : <p role='status'>Opening document…</p>
      }
      onContentError={() => setLoadFailed(true)}
      onException={() => setLoadFailed(true)}
    />
  );
}
