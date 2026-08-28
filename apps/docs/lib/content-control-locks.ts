import type { LockMode } from '@superdoc/document-api';

export type ContentControlLockOptions = {
  cannotDelete: boolean;
  cannotEdit: boolean;
};

export const contentControlLockModes = [
  {
    cannotDelete: false,
    cannotEdit: false,
    lockMode: 'unlocked',
  },
  {
    cannotDelete: true,
    cannotEdit: false,
    lockMode: 'sdtLocked',
  },
  {
    cannotDelete: false,
    cannotEdit: true,
    lockMode: 'contentLocked',
  },
  {
    cannotDelete: true,
    cannotEdit: true,
    lockMode: 'sdtContentLocked',
  },
] as const satisfies ReadonlyArray<ContentControlLockOptions & { lockMode: LockMode }>;

export function getContentControlLockMode(options: ContentControlLockOptions): LockMode {
  return (
    contentControlLockModes.find(
      ({ cannotDelete, cannotEdit }) => cannotDelete === options.cannotDelete && cannotEdit === options.cannotEdit,
    )?.lockMode ?? 'unlocked'
  );
}

export function getContentControlLockOptions(lockMode: LockMode): ContentControlLockOptions {
  const match = contentControlLockModes.find((option) => option.lockMode === lockMode);
  return match ?? { cannotDelete: false, cannotEdit: false };
}

export function renderContentControlLocksMarkdown() {
  return [
    '> **Interactive editor: Lock a template field**',
    '>',
    '> The service-agreement DOCX contains one text control tagged `client.address`. The demo applies the same two locking choices that Word exposes:',
    '>',
    '> - **Content control cannot be deleted** protects the field wrapper.',
    '> - **Contents cannot be edited** blocks changes inside the field.',
    '>',
    '> Toggle either choice, then edit or delete the field. Reset restores the prepared document.',
    '',
  ].join('\n');
}
