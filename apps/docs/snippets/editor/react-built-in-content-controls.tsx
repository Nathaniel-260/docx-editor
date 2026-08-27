import { SuperDocEditor, type SuperDocEditorProps } from '@superdoc/react';
import { useCallback, useState } from 'react';
import type { ContentControlClickPayload } from 'superdoc';
import '@superdoc/react/style.css';

const editorConfig = {
  ui: {
    contentControls: true,
  },
} satisfies Pick<SuperDocEditorProps, 'ui'>;

export default function App() {
  const [status, setStatus] = useState('Click a content control.');
  const handleContentControlClick = useCallback(({ target }: ContentControlClickPayload) => {
    const name = target.alias ?? target.tag ?? target.id;
    setStatus(`${name} · tag: ${target.tag ?? 'none'} · type: ${target.controlType}`);
  }, []);

  return (
    <>
      <SuperDocEditor
        document='/content-controls-sample.docx'
        ui={editorConfig.ui}
        onContentControlClick={handleContentControlClick}
      />
      <output aria-live='polite'>{status}</output>
    </>
  );
}
