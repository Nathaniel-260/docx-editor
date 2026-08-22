import type { Config } from 'superdoc';

export const startupOptions = {
  documentMode: 'suggesting',
  user: {
    name: 'Jordan Lee',
    email: 'jordan@example.com',
  },
} satisfies Partial<Config>;
