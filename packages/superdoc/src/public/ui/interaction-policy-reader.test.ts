/**
 * Tracked-change decisions have their own resolved interaction policy.
 *
 * Comment capability must not accidentally control accept/reject. Older hosts
 * exposed only `comments.readOnly`, so that field remains the fallback when
 * the dedicated tracked-change answer is absent.
 */
import { describe, expect, it, vi } from 'vite-plus/test';

import { createSuperDocUI } from './create-super-doc-ui.js';

/**
 * Drive the guard through a route that consults it, and report whether the
 * underlying document operation was reached.
 */
function attemptTrackedChangeDecision(superdoc: unknown): boolean {
  const acceptTrackedChange = vi.fn(() => true);
  const host = superdoc as Record<string, Record<string, unknown>>;
  (host.activeEditor as Record<string, unknown>).doc = {
    trackChanges: { accept: acceptTrackedChange, acceptTrackedChange },
  };
  const ui = createSuperDocUI({ superdoc } as never) as unknown as Record<string, Record<string, unknown>>;
  const route = ui.trackChanges?.accept as ((id: string) => unknown) | undefined;
  route?.('t1');
  return acceptTrackedChange.mock.calls.length > 0;
}

function readAcceptChangeReason(superdoc: unknown): string | undefined {
  const host = superdoc as Record<string, Record<string, unknown>>;
  (host.activeEditor as Record<string, unknown>).doc = {
    trackChanges: { accept: vi.fn(() => true) },
  };
  const ui = createSuperDocUI({ superdoc } as never);
  return ui.commands.get('acceptChange').getState().reason;
}

const hostWithPolicy = (readOnly: boolean, allowDecisions?: boolean, documentMode = 'editing') => ({
  interactionConfig: {
    comments: { readOnly, allowResolve: true },
    ...(allowDecisions === undefined ? {} : { trackedChanges: { allowDecisions } }),
  },
  // `ui: false` leaves `modules.comments === false`, so the legacy block
  // carries no policy at all.
  config: { documentMode, modules: { comments: false } },
  activeEditor: { editorVersion: 2, doc: {} },
});

describe('tracked-change decision policy with the built-in comments UI disabled', () => {
  it('allows decisions independently while comments are read-only', () => {
    expect(attemptTrackedChangeDecision(hostWithPolicy(true, true))).toBe(true);
  });

  it('blocks decisions independently while comments are writable', () => {
    const host = hostWithPolicy(false, false);
    expect(attemptTrackedChangeDecision(host)).toBe(false);
    expect(readAcceptChangeReason(host)).toBe('tracked-change-decisions-disabled');
  });

  it('keeps document viewing distinct from interaction policy', () => {
    expect(readAcceptChangeReason(hostWithPolicy(false, true, 'viewing'))).toBe('document-readonly');
  });

  it('keeps comments.readOnly as the fallback for an older resolved host', () => {
    expect(attemptTrackedChangeDecision(hostWithPolicy(true))).toBe(false);
  });

  it('keeps older writable hosts permissive', () => {
    expect(attemptTrackedChangeDecision(hostWithPolicy(false))).toBe(true);
  });
});
