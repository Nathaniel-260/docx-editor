/** Consumer typecheck for `SuperDoc#canPerformPermission`. */
import type { CanPerformPermissionParams, SuperDoc } from 'superdoc';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type AssertEqual<A, B> = Equal<A, B> extends true ? true : never;

declare const sd: SuperDoc;

const _paramsOk: AssertEqual<
  Parameters<SuperDoc['canPerformPermission']>,
  [params?: CanPerformPermissionParams]
> = true;

const _returnOk: AssertEqual<ReturnType<SuperDoc['canPerformPermission']>, boolean> = true;

const params: CanPerformPermissionParams = {
  permission: 'RESOLVE_OWN',
  role: 'editor',
  isInternal: true,
  comment: { id: 'c-1', authorEmail: 'a@x.com' },
  trackedChange: { id: 'tc-1', commentId: 'c-1' },
};
const _allowed: boolean = sd.canPerformPermission(params);
void _allowed;

const _emptyAllowed: boolean = sd.canPerformPermission();
void _emptyAllowed;

void [_paramsOk, _returnOk];
