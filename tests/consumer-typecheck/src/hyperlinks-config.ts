import type {
  Config,
  HyperlinkActivationContext,
  HyperlinkActivationHandler,
  HyperlinkActivationResult,
  HyperlinkRenderContext,
  HyperlinksConfig,
  LinkPopoverConfig,
  LinkPopoverResolver,
} from 'superdoc';

const onActivate: HyperlinkActivationHandler = (context: HyperlinkActivationContext): HyperlinkActivationResult => {
  const _defaultAction: 'edit' | 'navigate' = context.defaultAction;
  if (context.isAnchorLink) return { type: 'default' };
  if (context.href.startsWith('https://app.example.com/')) return { type: 'none' };
  return {
    type: 'render',
    render: ({ container, href, close }: HyperlinkRenderContext) => {
      container.textContent = href;
      const button = document.createElement('button');
      button.addEventListener('click', close);
      container.append(button);
      return { destroy: () => button.removeEventListener('click', close) };
    },
  };
};

const _options: HyperlinksConfig = { onActivate };

const _canonical: Config = {
  selector: '#editor',
  hyperlinks: { onActivate },
};

const _disabled: Config = {
  selector: '#editor',
  hyperlinks: false,
};

// Deprecated public types and configuration remain source-compatible in v2.
const legacyResolver: LinkPopoverResolver = () => ({ type: 'default' });
const _legacyOptions: LinkPopoverConfig = { popoverResolver: legacyResolver };
const _legacy: Config = {
  selector: '#editor',
  ui: { linkPopover: _legacyOptions },
  modules: { links: { popoverResolver: legacyResolver } },
};

void [_options, _canonical, _disabled, _legacy];
