const KEYBOARD_DELETE_INPUT_KINDS = new Set(['keydown', 'beforeinput']);
const KEYBOARD_DELETE_COMMAND_KINDS = new Set(['delete-backward', 'delete-forward']);
const KEYBOARD_DELETE_FAILURE_SOURCES = new Set(['shell', 'receipt']);

export const V2_EDIT_REJECTED_CODE = 'edit-rejected';
export const V2_EDIT_REJECTED_MESSAGE = 'This edit couldn’t be completed. Adjust the selection and try again.';

export function isV2KeyboardEditRejection(event) {
  return Boolean(
    event &&
    event.type === 'mutation:rejected' &&
    event.origin === 'document-surface' &&
    KEYBOARD_DELETE_FAILURE_SOURCES.has(event.failureSource) &&
    (event.inputKind === 'cut' ||
      (KEYBOARD_DELETE_INPUT_KINDS.has(event.inputKind) &&
        KEYBOARD_DELETE_COMMAND_KINDS.has(event.editableCommandKind))),
  );
}

export function createV2KeyboardEditRejectionException(documentId) {
  return {
    error: new Error(V2_EDIT_REJECTED_MESSAGE),
    code: V2_EDIT_REJECTED_CODE,
    editor: null,
    ...(typeof documentId === 'string' && documentId.length > 0 ? { documentId } : {}),
  };
}

export function resolveV2MutationNoticeStatuses(scope, authorRequiredMessages, editRejectedMessages) {
  const authorRequired = authorRequiredMessages?.[scope] ?? null;
  return {
    authorRequired,
    editRejected: authorRequired ? null : (editRejectedMessages?.[scope] ?? null),
  };
}

export function createV2KeyboardEditRejectionNotificationGate() {
  const notifiedScopes = new Set();
  const keyFor = (scope) => (typeof scope === 'string' && scope.length > 0 ? scope : '__default__');
  return {
    shouldNotify(scope, event) {
      if (!isV2KeyboardEditRejection(event)) return false;
      const key = keyFor(scope);
      if (notifiedScopes.has(key)) return false;
      notifiedScopes.add(key);
      return true;
    },
    clear(scope) {
      notifiedScopes.delete(keyFor(scope));
    },
  };
}
