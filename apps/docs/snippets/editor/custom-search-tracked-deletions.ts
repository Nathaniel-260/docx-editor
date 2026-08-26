import type { SuperDoc } from 'superdoc';

export function findPendingDeletion(editor: SuperDoc) {
  return editor.ui.search.find('Legacy', {
    includeTrackedDeletions: true,
  });
}
