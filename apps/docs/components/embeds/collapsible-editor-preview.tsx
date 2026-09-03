'use client';

import { ChevronDown } from 'lucide-react';
import { type CSSProperties, type ReactNode, useId, useState } from 'react';

type CollapsibleEditorPreviewProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  defaultExpanded?: boolean;
  expandedMaxHeight?: CSSProperties['maxHeight'];
  onCollapse?: () => void;
};

export function CollapsibleEditorPreview({
  children,
  className = '',
  contentClassName = '',
  defaultExpanded = false,
  expandedMaxHeight,
  onCollapse,
}: CollapsibleEditorPreviewProps) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);

  function toggle() {
    if (expanded) onCollapse?.();
    setExpanded((current) => !current);
  }

  return (
    <div className={`sd-editor-preview ${className}`.trim()} data-expanded={expanded}>
      <div
        className={`sd-editor-preview-content ${contentClassName}`.trim()}
        id={contentId}
        style={expanded && expandedMaxHeight !== undefined ? { maxHeight: expandedMaxHeight } : undefined}
      >
        {children}
      </div>
      <div className='sd-editor-preview-fade' aria-hidden='true' />
      <button
        className='sd-editor-preview-toggle'
        type='button'
        aria-controls={contentId}
        aria-expanded={expanded}
        onClick={toggle}
      >
        <ChevronDown aria-hidden='true' />
        {expanded ? 'Collapse' : 'Expand'}
      </button>
    </div>
  );
}
