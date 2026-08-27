import { SuperDocEditor } from '@superdoc/react';
import '@superdoc/react/style.css';

export default function App() {
  return <SuperDocEditor document='/contract.docx' onReady={() => console.log('Document ready')} />;
}
