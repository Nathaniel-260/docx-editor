import type { HyperlinkActivationHandler } from 'superdoc';

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);
const HAS_PROTOCOL = /^[a-z][a-z0-9+.-]*:/i;

function getSafeHref(rawHref: string) {
  const href = rawHref.trim();
  if (!href) return null;
  if (href.startsWith('#')) return href;

  const candidate = HAS_PROTOCOL.test(href) ? href : `https://${href}`;

  try {
    return SAFE_PROTOCOLS.has(new URL(candidate).protocol) ? candidate : null;
  } catch {
    return null;
  }
}

export const handleHyperlinkActivation: HyperlinkActivationHandler = ({ href }) => {
  const safeHref = getSafeHref(href);
  if (!safeHref) return { type: 'none' };

  return {
    type: 'render',
    render: ({ container, close }) => {
      const panel = document.createElement('div');
      const link = document.createElement('a');
      const closeButton = document.createElement('button');

      link.href = safeHref;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Open hyperlink';

      closeButton.type = 'button';
      closeButton.textContent = 'Close';
      closeButton.addEventListener('click', close);

      panel.append(link, closeButton);
      container.append(panel);

      return {
        destroy() {
          closeButton.removeEventListener('click', close);
          panel.remove();
        },
      };
    },
  };
};
