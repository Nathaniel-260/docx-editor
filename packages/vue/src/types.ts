import type { SuperDoc } from 'superdoc';

/**
 * Types for @superdoc/vue
 *
 * Core types are extracted from the SuperDoc constructor parameter type,
 * ensuring they stay in sync with the superdoc package.
 */

// =============================================================================
// Extract types from SuperDoc constructor (single source of truth)
// =============================================================================

/** SuperDoc constructor config - extracted from superdoc package */
type SuperDocConstructorConfig = ConstructorParameters<typeof SuperDoc>[0];

/** SuperDoc instance type - from superdoc package */
export type SuperDocInstance = InstanceType<typeof SuperDoc>;

/** Document mode - extracted from Config.documentMode */
export type DocumentMode = NonNullable<SuperDocConstructorConfig['documentMode']>;

/** User role - extracted from Config.role */
export type UserRole = NonNullable<SuperDocConstructorConfig['role']>;

/** User object - extracted from Config.user */
export type SuperDocUser = NonNullable<SuperDocConstructorConfig['user']>;

/** Modules configuration - extracted from Config.modules */
export type SuperDocModules = NonNullable<SuperDocConstructorConfig['modules']>;

/** Built-in UI configuration - extracted from Config.ui */
export type SuperDocUIConfig = SuperDocConstructorConfig['ui'];

/** Full SuperDoc config - extracted from constructor */
export type SuperDocConfig = SuperDocConstructorConfig;

// =============================================================================
// Event Types
// =============================================================================

/** Event emitted as `ready` */
export type SuperDocReadyEvent = Parameters<NonNullable<SuperDocConfig['onReady']>>[0];

/** Event emitted as `editor-create` */
export type SuperDocEditorCreateEvent = Parameters<NonNullable<SuperDocConfig['onEditorCreate']>>[0];

/** Event emitted as `editor-update`. Mirrors superdoc's EditorUpdateEvent. */
export type SuperDocEditorUpdateEvent = Parameters<NonNullable<SuperDocConfig['onEditorUpdate']>>[0];

/** Event emitted as `transaction`. Mirrors superdoc's EditorTransactionEvent. */
export type SuperDocTransactionEvent = Parameters<NonNullable<SuperDocConfig['onTransaction']>>[0];

/**
 * Event emitted as `content-error`. Re-derived from the core
 * `Config.onContentError` parameter so this wrapper cannot drift from the
 * core contract.
 */
export type SuperDocContentErrorEvent = Parameters<NonNullable<SuperDocConfig['onContentError']>>[0];

/**
 * Event emitted as `exception`. Re-exports the core union so consumers get
 * the same three runtime shapes the core documents; narrow with
 * `'stage' in event` or `'code' in event`.
 */
export type SuperDocExceptionEvent = import('superdoc').SuperDocExceptionPayload;

/** Event emitted as `zoom-change`. Re-derived from the core `Config.onZoomChange` parameter. */
export type SuperDocZoomChangeEvent = Parameters<NonNullable<SuperDocConfig['onZoomChange']>>[0];

/** Event emitted as `viewport-change`. Re-derived from the core `Config.onViewportChange` parameter. */
export type SuperDocViewportChangeEvent = Parameters<NonNullable<SuperDocConfig['onViewportChange']>>[0];

// =============================================================================
// Component Types
// =============================================================================

/**
 * Config keys the component manages as dedicated reactive props (or owns
 * outright, like the mount targets). Everything else from the core config is
 * accepted through the `config` prop and applied at initialization only.
 *
 * - `selector` / `toolbar`: the component owns the mount elements.
 * - Callbacks: delivered as Vue events instead.
 */
type ManagedConfigKeys =
  | 'selector'
  | 'toolbar'
  | 'document'
  | 'documentMode'
  | 'role'
  | 'user'
  | 'users'
  | 'modules'
  | 'ui'
  | 'contained'
  | 'onReady'
  | 'onEditorCreate'
  | 'onEditorDestroy'
  | 'onEditorUpdate'
  | 'onTransaction'
  | 'onContentError'
  | 'onException'
  | 'onZoomChange'
  | 'onViewportChange';

/**
 * The constructor-only remainder of the core config, passed through the
 * `config` prop. Applied when the instance is created; later changes are
 * ignored (a dev warning points here). Use `getInstance()` for runtime
 * changes, or one of the managed props when one exists.
 */
export type SuperDocEditorConfig = Omit<SuperDocConfig, ManagedConfigKeys>;

/**
 * What the component exposes through a template ref.
 */
export interface SuperDocEditorExpose {
  /** Get the underlying SuperDoc instance. Returns null until initialization completes. */
  getInstance(): SuperDocInstance | null;
}
