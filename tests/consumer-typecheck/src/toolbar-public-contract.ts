/**
 * Consumer typecheck: the built-in toolbar has a named, readonly-friendly
 * startup contract and exposes the types used by its callback and font rows.
 */
import type {
  Config,
  ToolbarConfig,
  ToolbarCustomButtonCommand,
  ToolbarDropdownOption,
  ToolbarFontOption,
} from 'superdoc';

const fonts = [{ label: 'Inter', key: 'Inter, sans-serif' }] as const satisfies readonly ToolbarFontOption[];

const save: ToolbarCustomButtonCommand = ({ option }) => {
  const selected: ToolbarDropdownOption | undefined = option;
  return selected?.key;
};

const toolbar = {
  container: '#toolbar',
  groups: {
    left: ['undo', 'redo'],
    center: ['bold', 'italic'],
  },
  excludeItems: ['image', 'table'],
  fonts,
  customButtons: [{ type: 'button', name: 'save', icon: '<svg />', command: save }],
} as const satisfies ToolbarConfig;

const _config: Config = {
  selector: '#editor',
  ui: { toolbar },
};

// Previous spellings remain source-compatible while their declarations point
// consumers to `ui.toolbar`.
const _legacyConfig: Config = {
  selector: '#editor',
  toolbar: '#toolbar',
  toolbarGroups: ['left', 'center'],
  toolbarIcons: { bold: '<svg />' },
  toolbarTexts: { bold: 'Bold' },
  modules: {
    toolbar: {
      selector: '#toolbar',
      groups: { center: ['bold'] },
      excludeItems: ['image'],
    },
  },
};

void [_config, _legacyConfig];
