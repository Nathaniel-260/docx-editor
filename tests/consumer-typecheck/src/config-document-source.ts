/** Consumer contract for the document sources accepted by `Config.document`. */
import type {
  Config,
  Document,
  DocumentDataSource,
  DocumentSource,
  DocumentUploadSource,
  StructuredDocumentSource,
  SuperDoc,
} from 'superdoc';

declare const file: File;
declare const blob: Blob;
declare const bytes: Uint8Array;
declare const optionalUpload: { uid: string; name?: string; originFileObj?: File };

const upload: DocumentUploadSource = { originFileObj: file, uid: 'upload-1', name: 'contract.docx' };
const data: DocumentDataSource = bytes;

const sources: DocumentSource[] = [
  '/contract.docx',
  file,
  blob,
  bytes,
  new ArrayBuffer(8),
  upload,
  { data: file, name: 'contract.docx' },
  { data },
  { url: '/contract.docx', password: 'secret' },
  {
    data: file,
    v2Collaboration: {
      documentId: 'contract-1',
      roomMode: 'join',
      serverUrl: 'wss://collaboration.example.com',
    },
  },
];

const structured: StructuredDocumentSource = { data: upload, password: 'secret' };
const documentEntry: Document = { type: 'docx', data: file, password: 'secret' };
const documentEntryConfig: Config = { selector: '#editor', document: documentEntry };
const documentWithDataAndUrl: Document = { type: 'docx', data: file, url: '/contract.docx' };
const documentWithDataAndUrlConfig: Config = { selector: '#editor', document: documentWithDataAndUrl };
const optionalUploadConfig: Config = { selector: '#editor', document: optionalUpload };
declare const superdoc: SuperDoc;
const stateDocumentData: File | Blob | null | undefined = superdoc.state.documents[0]?.data;

for (const document of sources) {
  const config: Config = { selector: '#editor', document };
  void config;
}

const invalidObject: Config = {
  selector: '#editor',
  // @ts-expect-error A structured source needs data or a URL.
  document: { arbitrary: true },
};

const conflictingSources: Config = {
  selector: '#editor',
  // @ts-expect-error A structured source accepts either data or a URL.
  document: { data: bytes, url: '/contract.docx' },
};

const blankDocument: Config = { selector: '#editor', document: null };
const onContentError: NonNullable<Config['onContentError']> = ({ file: source }) => {
  const contentErrorSource: DocumentDataSource | null | undefined = source;
  void contentErrorSource;
};
type PreviousContentErrorHandler = (params: {
  error: unknown;
  editor: Parameters<NonNullable<Config['onContentError']>>[0]['editor'];
  documentId: string;
  file: File | Blob | null | undefined;
}) => void;
declare const previousContentErrorHandler: PreviousContentErrorHandler;
const previousContentErrorConfig: Config = {
  selector: '#editor',
  onContentError: previousContentErrorHandler,
};

void [
  structured,
  documentEntry,
  documentEntryConfig,
  documentWithDataAndUrl,
  documentWithDataAndUrlConfig,
  optionalUploadConfig,
  stateDocumentData,
  invalidObject,
  conflictingSources,
  blankDocument,
  onContentError,
  previousContentErrorConfig,
];
