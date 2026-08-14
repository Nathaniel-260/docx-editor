import { describe, expect, it } from 'vite-plus/test';
import type { DrawingBlock, ImageBlock, ShapeGroupImageChild } from '@superdoc/contracts';
import { createDrawingImageElement, createShapeGroupImageElement } from './drawing-image.js';
import { buildImageHyperlinkAnchor } from './hyperlink.js';
import { createBlockImageContent, resolveBlockImageClipPath } from './image-block.js';

describe('resolveBlockImageClipPath', () => {
  it('prefers a top-level clipPath over attrs.clipPath', () => {
    expect(
      resolveBlockImageClipPath({
        clipPath: 'inset(1% 2% 3% 4%)',
        attrs: { clipPath: 'inset(5% 6% 7% 8%)' },
      }),
    ).toBe('inset(1% 2% 3% 4%)');
  });

  it('falls back to attrs.clipPath when top-level clipPath is absent', () => {
    expect(resolveBlockImageClipPath({ attrs: { clipPath: 'inset(5% 6% 7% 8%)' } })).toBe('inset(5% 6% 7% 8%)');
  });

  it('ignores unsupported clip-path values', () => {
    expect(resolveBlockImageClipPath({ clipPath: 'url(#clip)' })).toBe('');
  });
});

describe('createBlockImageContent source crop', () => {
  it('clips and transforms a signed crop projected through ImageBlock attrs', () => {
    const doc = document.implementation.createHTMLDocument('block-image-crop');
    const clipContainer = doc.createElement('div');
    const clipPath = 'inset(65.336% -0.72% 0.951% 33.056%)';
    const block: ImageBlock = {
      kind: 'image',
      id: 'cropped-image',
      src: 'data:image/png;base64,AAA',
      width: 543,
      height: 381,
      attrs: { clipPath },
    };

    const element = createBlockImageContent({ doc, block, clipContainer }) as HTMLImageElement;

    expect(clipContainer.style.overflow).toBe('hidden');
    expect(element.style.objectFit).toBe('fill');
    expect(element.style.clipPath).toBe(clipPath);
    expect(element.style.transformOrigin).toBe('0 0');
    expect(element.style.transform).not.toBe('');
  });

  it('keeps the default contain fit when there is no source crop', () => {
    const doc = document.implementation.createHTMLDocument('uncropped-block-image');
    const block: ImageBlock = {
      kind: 'image',
      id: 'uncropped-image',
      src: 'data:image/png;base64,AAA',
      width: 543,
      height: 381,
    };

    const element = createBlockImageContent({ doc, block }) as HTMLImageElement;

    expect(element.style.objectFit).toBe('contain');
  });
});

describe('createBlockImageContent fail-closed placeholder', () => {
  it('fills the preserved image box and exposes the owning diagnostic', () => {
    const doc = document.implementation.createHTMLDocument('block-image-placeholder');
    const block: ImageBlock = {
      kind: 'image',
      id: 'unsupported-image',
      src: '',
      width: 240,
      height: 80,
      placeholder: {
        diagnosticIds: ['render.media.unsafe-svg'],
        accessibleName: 'Unsafe SVG image',
      },
    };

    const element = createBlockImageContent({ doc, block, className: 'superdoc-image-block' });

    expect(element.tagName).toBe('SPAN');
    expect(element.classList.contains('superdoc-placeholder-block')).toBe(true);
    expect(element.classList.contains('superdoc-image-block')).toBe(true);
    expect(element.dataset.placeholderDiagnosticIds).toBe('render.media.unsafe-svg');
    expect(element.getAttribute('role')).toBe('img');
    expect(element.getAttribute('aria-label')).toBe('Unsafe SVG image');
    expect(element.style.width).toBe('100%');
    expect(element.style.height).toBe('100%');
  });
});

describe('createBlockImageContent picture outline', () => {
  it('paints a centered frame without changing the image box model', () => {
    const doc = document.implementation.createHTMLDocument('block-image-outline');
    const block: ImageBlock = {
      kind: 'image',
      id: 'outlined-image',
      src: 'data:image/png;base64,AAA',
      width: 240,
      height: 80,
      outline: { color: '#4472C4', width: 2 },
    };

    const element = createBlockImageContent({ doc, block }) as HTMLImageElement;

    expect(element.style.width).toBe('100%');
    expect(element.style.height).toBe('100%');
    expect(element.style.outlineWidth).toBe('2px');
    expect(element.style.outlineStyle).toBe('solid');
    expect(element.style.outlineColor).toBe('#4472C4');
    expect(element.style.outlineOffset).toBe('-1px');
    expect(element.style.borderWidth).toBe('');
  });
});

describe('createDrawingImageElement', () => {
  const createDoc = (): Document => document.implementation.createHTMLDocument('drawing-image');

  it('applies unified image filters to drawing images', () => {
    const doc = createDoc();
    const drawing = {
      kind: 'drawing',
      drawingKind: 'image',
      id: 'drawing-image-filtered',
      src: 'data:image/png;base64,AAA',
      grayscale: true,
      gain: 2,
      alphaModFix: { amt: 9000 },
    } as DrawingBlock;

    const imgEl = createDrawingImageElement(doc, drawing, (imageEl) => imageEl) as HTMLImageElement;

    expect(imgEl.style.display).toBe('block');
    expect(imgEl.style.filter).toContain('grayscale(100%)');
    expect(imgEl.style.filter).toContain('contrast(2)');
    expect(imgEl.style.opacity).toBe('0.09');
  });

  it('wraps drawing images with unified hyperlink anchors', () => {
    const doc = createDoc();
    const drawing = {
      kind: 'drawing',
      drawingKind: 'image',
      id: 'drawing-image-linked',
      src: 'data:image/png;base64,AAA',
      hyperlink: { url: 'https://example.com/drawing-image', tooltip: 'Open drawing image' },
    } as DrawingBlock;

    const anchor = createDrawingImageElement(doc, drawing, (imageEl, hyperlink, display) =>
      buildImageHyperlinkAnchor(doc, imageEl, hyperlink, display),
    ) as HTMLAnchorElement;

    expect(anchor.tagName).toBe('A');
    expect(anchor.classList.contains('superdoc-link')).toBe(true);
    expect(anchor.href).toBe('https://example.com/drawing-image');
    expect(anchor.style.display).toBe('block');
    expect(anchor.querySelector('img.superdoc-drawing-image')).toBeTruthy();
  });
});

describe('createShapeGroupImageElement', () => {
  const createDoc = (): Document => document.implementation.createHTMLDocument('shape-group-image');

  it('applies DrawingML fixed alpha to grouped images', () => {
    const doc = createDoc();
    const child: ShapeGroupImageChild = {
      shapeType: 'image',
      attrs: {
        x: 0,
        y: 0,
        width: 120,
        height: 80,
        src: 'data:image/png;base64,AAA',
        alphaModFix: { amt: 9000 },
      },
    };

    const imgEl = createShapeGroupImageElement(doc, child) as HTMLImageElement;

    expect(imgEl.src).toBe('data:image/png;base64,AAA');
    expect(imgEl.style.display).toBe('block');
    expect(imgEl.style.opacity).toBe('0.09');
  });
});
