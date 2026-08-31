import { describe, expect, it } from 'vite-plus/test';

import {
  createV2KeyboardEditRejectionException,
  createV2KeyboardEditRejectionNotificationGate,
  isV2KeyboardEditRejection,
  resolveV2MutationNoticeStatuses,
  V2_EDIT_REJECTED_CODE,
  V2_EDIT_REJECTED_MESSAGE,
} from './v2-keyboard-edit-rejection.js';

const shellRejection = (inputKind, editableCommandKind) => ({
  type: 'mutation:rejected',
  origin: 'document-surface',
  failureSource: 'shell',
  reason: 'raw-internal-reason',
  message: 'raw internal detail',
  inputKind,
  editableCommandKind,
});

describe('isV2KeyboardEditRejection', () => {
  it('matches backward and forward deletion from keydown, beforeinput, and Cut', () => {
    for (const inputKind of ['keydown', 'beforeinput', 'cut']) {
      for (const commandKind of ['delete-backward', 'delete-forward']) {
        expect(isV2KeyboardEditRejection(shellRejection(inputKind, commandKind))).toBe(true);
      }
    }
    expect(
      isV2KeyboardEditRejection({
        ...shellRejection('keydown', 'delete-backward'),
        failureSource: 'receipt',
        failure: { code: 'INVALID_CONTEXT', message: 'raw internal detail' },
      }),
    ).toBe(true);
  });

  it('ignores insert, paste, navigation, history, review, and programmatic failures', () => {
    for (const commandKind of ['insert-text', 'plain-text-paste', 'caret-keyboard-navigation']) {
      expect(isV2KeyboardEditRejection(shellRejection('keydown', commandKind))).toBe(false);
    }
    expect(
      isV2KeyboardEditRejection({
        type: 'mutation:rejected',
        origin: 'history',
        failureSource: 'shell',
        inputKind: 'keydown',
        editableCommandKind: 'delete-backward',
      }),
    ).toBe(false);
    expect(
      isV2KeyboardEditRejection({
        type: 'mutation:rejected',
        origin: 'review',
        failureSource: 'shell',
        inputKind: 'keydown',
        editableCommandKind: 'delete-backward',
      }),
    ).toBe(false);
    expect(
      isV2KeyboardEditRejection({
        type: 'mutation:rejected',
        origin: 'command',
        failureSource: 'receipt',
        failure: { code: 'INVALID_CONTEXT', message: 'raw internal detail' },
      }),
    ).toBe(false);
  });

  it('ignores non-keyboard and non-rejection events', () => {
    expect(isV2KeyboardEditRejection(shellRejection('cut', undefined))).toBe(true);
    expect(isV2KeyboardEditRejection(shellRejection('paste', 'delete-backward'))).toBe(false);
    expect(isV2KeyboardEditRejection(shellRejection('programmatic', 'delete-forward'))).toBe(false);
    expect(isV2KeyboardEditRejection({ type: 'mutation:committed' })).toBe(false);
    expect(isV2KeyboardEditRejection(null)).toBe(false);
    expect(isV2KeyboardEditRejection(undefined)).toBe(false);
  });

  it('deduplicates per document and re-arms only the cleared session', () => {
    const gate = createV2KeyboardEditRejectionNotificationGate();
    const rejection = shellRejection('keydown', 'delete-backward');
    expect(gate.shouldNotify('doc-a', rejection)).toBe(true);
    expect(gate.shouldNotify('doc-a', rejection)).toBe(false);
    expect(gate.shouldNotify('doc-b', rejection)).toBe(true);
    gate.clear('doc-a');
    expect(gate.shouldNotify('doc-a', rejection)).toBe(true);
    expect(gate.shouldNotify('doc-b', rejection)).toBe(false);
  });

  it('exposes only a stable generic code and content-safe message', () => {
    expect(V2_EDIT_REJECTED_CODE).toBe('edit-rejected');
    expect(V2_EDIT_REJECTED_MESSAGE).toBe('This edit couldn’t be completed. Adjust the selection and try again.');
    expect(V2_EDIT_REJECTED_MESSAGE).not.toMatch(/raw|INVALID_|section|table|tracked|receipt/i);
  });

  it('builds an exception payload without the raw rejection event', () => {
    const exception = createV2KeyboardEditRejectionException('doc-a');
    expect(Object.keys(exception).sort()).toEqual(['code', 'documentId', 'editor', 'error']);
    expect(exception).toMatchObject({ code: 'edit-rejected', documentId: 'doc-a', editor: null });
    expect(exception.error).toBeInstanceOf(Error);
    expect(exception.error.message).toBe(V2_EDIT_REJECTED_MESSAGE);
    expect(JSON.stringify(exception)).not.toMatch(/raw-internal-reason|raw internal detail/);
  });

  it('shows only the active document notice and preserves author-required priority', () => {
    const authorRequiredMessages = { 'document:doc-a': 'Set an author.' };
    const editRejectedMessages = { 'document:doc-b': V2_EDIT_REJECTED_MESSAGE };

    expect(resolveV2MutationNoticeStatuses('document:doc-b', authorRequiredMessages, editRejectedMessages)).toEqual({
      authorRequired: null,
      editRejected: V2_EDIT_REJECTED_MESSAGE,
    });
    expect(resolveV2MutationNoticeStatuses('document:doc-a', authorRequiredMessages, editRejectedMessages)).toEqual({
      authorRequired: 'Set an author.',
      editRejected: null,
    });
  });
});
