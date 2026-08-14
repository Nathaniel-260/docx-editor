'use client';

import { ChevronDown } from 'lucide-react';
import { type ReactNode, useId, useState } from 'react';

type CollapsibleEditorPreviewProps = {
  children: ReactNode;
  className?: string;
  onCollapse?: () => void;
};

export function CollapsibleEditorPreview({ children, className = '', onCollapse }: CollapsibleEditorPreviewProps) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(false);

  function toggle() {
    if (expanded) onCollapse?.();
    setExpanded((current) => !current);
  }

  return (
    <div className={`sd-editor-preview ${className}`.trim()} data-expanded={expanded}>
      <div className='sd-editor-preview-content' id={contentId}>
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
