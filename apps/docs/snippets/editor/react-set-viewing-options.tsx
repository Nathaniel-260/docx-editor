import { SuperDocEditor } from '@superdoc/react';
import '@superdoc/react/style.css';

export function Editor() {
  return (
    <SuperDocEditor
      document='/sample.docx'
      documentMode='viewing'
      onReady={({ superdoc }) => {
        superdoc.setViewingOptions({ trackedChanges: 'final' });
      }}
    />
  );
}
