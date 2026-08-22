import type { SuperDocEditorProps } from '@superdoc/react';

export const startupOptions = {
  documentMode: 'suggesting',
  user: {
    name: 'Jordan Lee',
    email: 'jordan@example.com',
  },
} satisfies Partial<SuperDocEditorProps>;
