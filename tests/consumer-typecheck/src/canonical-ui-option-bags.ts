/**
 * Consumer typecheck: the canonical `ui` option bags reject unknown keys.
 *
 * `ui.comments`, `ui.search`, and `ui.contentControls` were declared as
 * `boolean | Record<string, unknown>`, so a misspelled option compiled and
 * then did nothing: the runtime ignores the unknown key, the surface keeps its
 * default, and the symptom is "my configuration had no effect" with no
 * diagnostic anywhere (#1094).
 *
 * The valid cases matter as much as the rejected ones. A type narrow enough to
 * catch a typo is also narrow enough to reject a field the runtime honors, and
 * that failure is worse: it blocks a working configuration at compile time.
 * Each accepted field below is one the runtime reads.
 *
 * All three canonical bags now have fixed public contracts. Legacy comment
 * pass-through options remain available through `modules.comments`, while
 * `ui.comments` rejects unknown presentation fields instead of accepting a
 * typo that has no effect.
 */
import type {
  CommentInteractionConfig,
  CommentsConfig,
  CommentsLayout,
  CommentsResponsiveConfig,
  ContentControlsConfig,
  Config,
  FindReplaceConfig,
} from 'superdoc';

// --- Accepted: every field the runtime actually reads ----------------------

// Layout is canonical. Advanced responsive settings stay grouped under the
// decision they affect instead of exposing compact-mode implementation names.
const _comments: Config = {
  selector: '#editor',
  ui: {
    comments: {
      layout: 'auto',
      responsive: {
        target: '#doc',
        breakpoint: 720,
      },
    },
  },
};

const _typoComments: Config = {
  selector: '#editor',
  // @ts-expect-error `layuot` is not a comments UI option.
  ui: { comments: { layuot: 'inline' } },
};

// `ui.search` options reach `useFindReplace` as its config, so the surface's
// own type is the shape rather than a parallel one.
const _search: Config = {
  selector: '#editor',
  ui: { search: { findPlaceholder: 'Search', closeLabel: 'Dismiss' } },
};

// The whole `floating` bag is spread into the surface request and applied over
// the `modules.surfaces.floating` defaults, so every field in it is honored --
// including the two that were undeclared until this change and would otherwise
// have been rejected the moment `ui.search` stopped accepting any object.
const _searchFloating: Config = {
  selector: '#editor',
  ui: {
    search: {
      floating: {
        placement: 'bottom-center',
        maxWidth: 480,
        autoFocus: false,
        closeOnOutsidePointerDown: true,
      },
    },
  },
};

// `chrome` is the whole bag this surface has.
const _contentControls: Config = {
  selector: '#editor',
  ui: { contentControls: { chrome: 'none' } },
};

// The boolean sentinels stay valid: narrowing the object form must not cost
// the on/off spelling every surface accepts.
const _sentinels: Config = {
  selector: '#editor',
  ui: { comments: false, search: true, contentControls: false },
};

// --- Rejected: the typos that used to compile ------------------------------

const _typoSearch: Config = {
  selector: '#editor',
  // @ts-expect-error `totallyInvented` is not a find/replace option (#1094).
  ui: { search: { totallyInvented: true } },
};

const _typoChrome: Config = {
  selector: '#editor',
  // @ts-expect-error `chromee` is not a content-control option (#1094).
  ui: { contentControls: { chromee: 'none' } },
};

// A wrong value for a real key, which is the other half of the same mistake.
// This one is caught even in the open bag: the key is named, so its type
// applies even though unknown keys fall through to the index signature.
const _badDisplayMode: Config = {
  selector: '#editor',
  // @ts-expect-error 'sidebarr' is not one of the three layouts.
  ui: { comments: { layout: 'sidebarr' } },
};

// Policy is not presentation. `normalizeUiConfig` strips these three before
// anything reads them, so accepting them here would advertise a setting that
// is silently discarded — the same shape of bug as an option bag nobody reads.
// They are rejected even though the bag is otherwise open.
const _policyReadOnly: Config = {
  selector: '#editor',
  // @ts-expect-error `readOnly` is policy; set it on `interaction.comments`.
  ui: { comments: { readOnly: true } },
};

const _policyAllowResolve: Config = {
  selector: '#editor',
  // @ts-expect-error `allowResolve` is policy; set it on `interaction.comments`.
  ui: { comments: { allowResolve: false } },
};

const _policyLevel: Config = {
  selector: '#editor',
  // @ts-expect-error `level` is policy; set it on `interaction.comments`.
  ui: { comments: { level: 'read' } },
};

const _policyResolver: Config = {
  selector: '#editor',
  // @ts-expect-error `permissionResolver` is collaboration wiring; it has no
  // `ui` spelling and is read off `modules.comments` or top-level `Config`.
  ui: { comments: { permissionResolver: () => true } },
};

// Deprecated aliases remain source-compatible while their declarations point
// consumers to `layout` and `responsive`.
const _deprecatedPresentation: Config = {
  selector: '#editor',
  ui: {
    comments: {
      displayMode: 'inline',
      compactMeasurementSelector: '#doc',
      compactBreakpointPx: 720,
      highlightHoverColor: '#eef',
      highlightColors: { internal: '#fee', activeExternal: '#eff' },
      highlightOpacity: { active: 0.4, inactive: 0.2 },
      trackChangeHighlightColors: { insertBorder: '#0a0' },
      trackChangeActiveHighlightColors: { deleteBackground: '#fdd' },
    },
  },
};

// The legacy block still accepts its fields for v2 compatibility.
// `permissionResolver` has no `interaction` spelling: `pickResolver` checks
// `modules.comments.permissionResolver`, then the top-level `Config` field.
const _legacyPolicy: Config = {
  selector: '#editor',
  modules: { comments: { readOnly: true, allowResolve: false, permissionResolver: () => true } },
};

// The deprecated interaction spelling remains type-compatible.
const _interactionPolicy: Config = {
  selector: '#editor',
  interaction: { comments: { readOnly: true, allowResolve: false } },
};

// The other resolver spelling, which `pickResolver` falls back to when the
// comments-scoped one is absent.
const _topLevelResolver: Config = {
  selector: '#editor',
  permissionResolver: () => true,
};

const _badChrome: Config = {
  selector: '#editor',
  // @ts-expect-error 'outline' is not a chrome style the painter accepts.
  ui: { contentControls: { chrome: 'outline' } },
};

// The interfaces are reachable by name, so an application can annotate the
// config it builds before handing it over.
const _namedComments: CommentsConfig = { layout: 'auto' };
const _namedLayout: CommentsLayout = 'inline';
const _namedResponsive: CommentsResponsiveConfig = { target: document.body, breakpoint: 900 };
const _namedInteraction: CommentInteractionConfig = { level: 'write' };
const _namedChrome: ContentControlsConfig = { chrome: 'default' };
const _namedSearch: FindReplaceConfig = { findPlaceholder: 'Find' };

export {
  _comments,
  _typoComments,
  _search,
  _searchFloating,
  _contentControls,
  _sentinels,
  _typoSearch,
  _typoChrome,
  _badDisplayMode,
  _badChrome,
  _policyReadOnly,
  _policyAllowResolve,
  _policyLevel,
  _policyResolver,
  _deprecatedPresentation,
  _legacyPolicy,
  _interactionPolicy,
  _topLevelResolver,
  _namedComments,
  _namedLayout,
  _namedResponsive,
  _namedInteraction,
  _namedChrome,
  _namedSearch,
};
