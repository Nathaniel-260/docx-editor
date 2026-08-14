// @ts-check

import { trackedChangeThreadParentIdForComment } from '../../components/CommentsLayer/tracked-change-threading.js';

/**
 * @param {string|null|undefined} side
 * @returns {'source'|'destination'|null}
 */
const trackedChangeSideGroup = (side) => {
  if (side === 'source' || side === 'deleted') return 'source';
  if (side === 'destination' || side === 'inserted') return 'destination';
  return null;
};

/**
 * @param {{ semanticColorKey?: string|null }} comment
 * @returns {'source'|'destination'|null}
 */
const trackedChangeRowSideGroup = (comment) => {
  if (comment?.semanticColorKey === 'move-from') return 'source';
  if (comment?.semanticColorKey === 'move-to') return 'destination';
  return null;
};

/**
 * Resolve explicit conversation provenance to the visible tracked-change row.
 * Canonical move ids are shared, so their persisted side selects the source or
 * destination card. Other ambiguous canonical ids remain unresolved.
 *
 * @template {{ commentId: string|number, trackedChange?: boolean, trackedChangeCanonicalId?: string|number|null, trackedChangeSide?: string|null, semanticColorKey?: string|null, parentCommentId?: string|number|null, threadingParentCommentId?: string|number|null, trackedChangeParentId?: string|number|null, trackedChangeThreadParentId?: string|number|null }} Comment
 * @param {ReadonlyArray<Comment>} allComments
 * @returns {Map<Comment, Comment>}
 */
export const buildTrackedChangeThreadOwnerIndex = (allComments) => {
  /** @type {Map<string, Comment[]>} */
  const trackedRowsById = new Map();
  /** @type {Map<string, Comment[]>} */
  const trackedRowsByCanonicalId = new Map();

  /**
   * @template Key, Value
   * @param {Map<Key, Value[]>} map
   * @param {Key} key
   * @param {Value} value
   */
  const append = (map, key, value) => {
    const existing = map.get(key);
    if (existing) existing.push(value);
    else map.set(key, [value]);
  };

  for (const comment of allComments) {
    if (comment?.trackedChange !== true) continue;
    if (typeof comment.commentId === 'string') append(trackedRowsById, comment.commentId, comment);
    if (comment.trackedChangeCanonicalId != null) {
      append(trackedRowsByCanonicalId, String(comment.trackedChangeCanonicalId), comment);
    }
  }

  /** @type {Map<Comment, Comment>} */
  const ownerByComment = new Map();
  for (const comment of allComments) {
    if (comment?.trackedChange === true) continue;
    const aliases = new Set(
      [comment.threadingParentCommentId, trackedChangeThreadParentIdForComment(comment)]
        .filter((id) => id != null)
        .map((id) => String(id)),
    );
    if (aliases.size === 0) continue;

    const directOwners = new Set([...aliases].flatMap((alias) => trackedRowsById.get(alias) ?? []));
    if (directOwners.size === 1) {
      ownerByComment.set(comment, [...directOwners][0]);
      continue;
    }
    if (directOwners.size > 1) continue;

    const canonicalOwners = new Set([...aliases].flatMap((alias) => trackedRowsByCanonicalId.get(alias) ?? []));
    if (canonicalOwners.size === 1) {
      ownerByComment.set(comment, [...canonicalOwners][0]);
      continue;
    }

    const sideGroup = trackedChangeSideGroup(comment.trackedChangeSide);
    if (!sideGroup) continue;
    const sideOwners = [...canonicalOwners].filter((owner) => trackedChangeRowSideGroup(owner) === sideGroup);
    if (sideOwners.length === 1) ownerByComment.set(comment, sideOwners[0]);
  }

  return ownerByComment;
};

/**
 * Build every tracked-change conversation in one graph pass.
 *
 * `CommentDialog` instances are intentionally mounted for every tracked-change
 * review card. Computing one thread by scanning the full comments list in each
 * instance turns a one-row prune into O(reviewRows * comments). This index
 * resolves parent edges once, then structurally shares unchanged thread arrays
 * with the previous index so Vue computed values for surviving cards keep the
 * same identity.
 *
 * Parent links and explicit tracked-change thread provenance are normalized by
 * the legacy collector, while the tracked-change row id is not. Keep that
 * asymmetry here so numeric tracked-change row ids do not acquire new thread
 * membership.
 *
 * @template {{ commentId: string|number, trackedChange?: boolean, trackedChangeCanonicalId?: string|number|null, trackedChangeSide?: string|null, semanticColorKey?: string|null, createdTime?: number, parentCommentId?: string|number|null, threadingParentCommentId?: string|number|null, trackedChangeParentId?: string|number|null }} Comment
 * @param {ReadonlyArray<Comment>} allComments
 * @param {ReadonlyMap<string|number, ReadonlyArray<Comment>>} [previous]
 * @returns {Map<string|number, ReadonlyArray<Comment>>}
 */
export const buildTrackedChangeThreadIndex = (allComments, previous = new Map()) => {
  /** @type {Map<string, Comment[]>} Parent links are normalized exactly as in the legacy collector. */
  const childrenByParentId = new Map();
  /** @type {Map<string, Comment[]>} Explicit conversation members keyed by their visible tracked-change row. */
  const anchoredCommentsByTrackedChangeId = new Map();
  /** @type {Map<string|number, Comment[]>} */
  const commentsById = new Map();
  /** @type {Map<Comment, number>} */
  const sourceIndex = new Map();
  const trackedChangeOwnerByComment = buildTrackedChangeThreadOwnerIndex(allComments);

  /**
   * @template Key, Value
   * @param {Map<Key, Value[]>} map
   * @param {Key} key
   * @param {Value} value
   */
  const append = (map, key, value) => {
    const existing = map.get(key);
    if (existing) existing.push(value);
    else map.set(key, [value]);
  };

  allComments.forEach((comment, index) => {
    sourceIndex.set(comment, index);
    append(commentsById, comment.commentId, comment);
    const parentIds = new Set(
      [comment.parentCommentId, comment.threadingParentCommentId].filter((id) => id != null).map((id) => String(id)),
    );
    parentIds.forEach((parentId) => append(childrenByParentId, parentId, comment));
    const owner = trackedChangeOwnerByComment.get(comment);
    if (owner?.commentId != null) {
      append(anchoredCommentsByTrackedChangeId, String(owner.commentId), comment);
    }
  });

  /** @type {Map<string|number, ReadonlyArray<Comment>>} */
  const next = new Map();
  for (const parentComment of allComments) {
    if (!parentComment?.trackedChange || parentComment.commentId == null) continue;
    const trackedChangeId = parentComment.commentId;
    const threadIds = new Set([trackedChangeId]);
    /** @type {Array<string|number>} */
    const queue = [];
    /** @type {string[]} */
    const threadParentIds = [];
    if (typeof trackedChangeId === 'string') {
      threadParentIds.push(trackedChangeId);
    }
    const seed = threadParentIds.flatMap((parentId) => [
      ...(childrenByParentId.get(parentId) ?? []),
      ...(anchoredCommentsByTrackedChangeId.get(parentId) ?? []),
    ]);
    for (const comment of seed) {
      const id = comment.commentId;
      if (id === trackedChangeId || threadIds.has(id)) continue;
      threadIds.add(id);
      queue.push(id);
    }
    for (let index = 0; index < queue.length; index += 1) {
      const parentId = queue[index];
      for (const comment of typeof parentId === 'string' ? (childrenByParentId.get(parentId) ?? []) : []) {
        const id = comment.commentId;
        if (threadIds.has(id)) continue;
        threadIds.add(id);
        queue.push(id);
      }
    }

    const members = [...threadIds]
      .flatMap((id) => commentsById.get(id) ?? [])
      .sort((left, right) => (sourceIndex.get(left) ?? 0) - (sourceIndex.get(right) ?? 0));
    members.sort((left, right) => {
      if (left === parentComment) return -1;
      if (right === parentComment) return 1;
      return Number(left.createdTime) - Number(right.createdTime);
    });
    const prior = previous.get(trackedChangeId);
    const stable =
      prior?.length === members.length && members.every((comment, index) => prior[index] === comment) ? prior : members;
    next.set(trackedChangeId, stable);
  }
  return next;
};

/**
 * Index the broader set of association fields used when a tracked-change
 * decision resolves or detaches linked comments. This is deliberately
 * separate from the visible conversation index above: a spatial
 * `trackedChangeParentId` must not make a comment appear in the review card,
 * but it still has to be detached when that tracked change is decided.
 *
 * @template {{ parentCommentId?: string|number|null, threadingParentCommentId?: string|number|null, trackedChangeParentId?: string|number|null, trackedChangeThreadParentId?: string|number|null }} Comment
 * @param {ReadonlyArray<Comment>} allComments
 * @param {ReadonlyMap<string, ReadonlyArray<Comment>>} [previous]
 * @returns {Map<string, ReadonlyArray<Comment>>}
 */
export const buildTrackedChangeDecisionLinkIndex = (allComments, previous = new Map()) => {
  /** @type {Map<string, Comment[]>} */
  const grouped = new Map();
  for (const comment of allComments) {
    const ids = new Set(
      [
        comment.parentCommentId,
        comment.threadingParentCommentId,
        comment.trackedChangeParentId,
        comment.trackedChangeThreadParentId,
      ]
        .filter((id) => id != null)
        .map((id) => String(id)),
    );
    for (const id of ids) {
      const existing = grouped.get(id);
      if (existing) existing.push(comment);
      else grouped.set(id, [comment]);
    }
  }

  /** @type {Map<string, ReadonlyArray<Comment>>} */
  const next = new Map();
  for (const [id, comments] of grouped) {
    const prior = previous.get(id);
    next.set(
      id,
      prior?.length === comments.length && comments.every((comment, index) => prior[index] === comment)
        ? prior
        : comments,
    );
  }
  return next;
};
