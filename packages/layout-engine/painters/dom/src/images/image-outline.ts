import type { ImageOutline } from '@superdoc/contracts';

/**
 * Paint a DrawingML picture frame without changing the image's layout box.
 * `a:ln` is centered on the picture geometry; a negatively offset CSS outline
 * reproduces that geometry while keeping width/height authoritative.
 */
export const applyImageOutline = (target: HTMLElement, outline?: ImageOutline): void => {
  if (!outline || !Number.isFinite(outline.width) || outline.width <= 0 || !outline.color) return;

  target.style.outline = `${outline.width}px solid ${outline.color}`;
  target.style.outlineOffset = `${-outline.width / 2}px`;
};
