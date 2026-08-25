import type { Config, ContextMenuConfig, SuperDoc } from 'superdoc';
import type { ContextMenuHandle, WorkflowActionResult } from 'superdoc/ui';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type AssertEqual<A, B> = Equal<A, B> extends true ? true : never;

const contextMenuConfig = {
  openOnSlash: false,
  defaultItems: false,
  sections: [
    {
      id: 'application-actions',
      items: [{ id: 'send-selection', label: 'Send selection', onSelect: () => undefined }],
    },
  ],
} satisfies ContextMenuConfig;

const deprecatedContextMenuConfig = {
  customItems: [{ id: 'application-actions', items: [{ id: 'send-selection', label: 'Send selection' }] }],
  includeDefaultItems: false,
} satisfies ContextMenuConfig;

const config = {
  selector: '#editor',
  ui: { contextMenu: contextMenuConfig },
} satisfies Config;

declare const superdoc: SuperDoc;

const contextMenu: ContextMenuHandle = superdoc.ui.contextMenu;
const _openResult: AssertEqual<ReturnType<ContextMenuHandle['open']>, WorkflowActionResult> = true;
const _closeResult: AssertEqual<ReturnType<ContextMenuHandle['close']>, void> = true;

void contextMenu.open();
contextMenu.close();
void [config, contextMenuConfig, deprecatedContextMenuConfig, _openResult, _closeResult];
