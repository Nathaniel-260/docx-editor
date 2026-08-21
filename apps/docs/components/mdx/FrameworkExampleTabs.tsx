'use client';

import { Children, isValidElement, type ReactNode, useMemo, useRef, useState } from 'react';
import { Check, Clipboard } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/ui/tabs';

const frameworks = ['Vanilla', 'React'] as const;
const storageKey = 'superdoc-docs-framework';

type Framework = (typeof frameworks)[number];
type FrameworkValue = Lowercase<Framework>;

type FrameworkExampleTabsProps = {
  children: ReactNode;
};

type FrameworkExampleProps = {
  children: ReactNode;
  filename: string;
  framework: Framework;
};

function frameworkValue(framework: Framework): FrameworkValue {
  return framework.toLowerCase() as FrameworkValue;
}

export function FrameworkExampleTabs({ children }: FrameworkExampleTabsProps) {
  const [selected, setSelected] = useState<FrameworkValue>('vanilla');
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const filenames = useMemo(() => {
    const entries = Children.toArray(children).flatMap((child) => {
      if (!isValidElement<FrameworkExampleProps>(child)) return [];
      return [[frameworkValue(child.props.framework), child.props.filename] as const];
    });

    return new Map<FrameworkValue, string>(entries);
  }, [children]);

  const copyActiveExample = async () => {
    const code = rootRef.current?.querySelector<HTMLElement>(`[data-framework-example='${selected}'] code`)?.innerText;
    if (!code) return;

    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Tabs
      className='sd-framework-example-tabs'
      groupId={storageKey}
      onValueChange={(value) => {
        if (value === 'vanilla' || value === 'react') {
          setSelected(value);
          setCopied(false);
        }
      }}
      persist
      ref={rootRef}
      value={selected}
    >
      <div className='sd-framework-example-bar'>
        <TabsList aria-label='Framework' className='sd-framework-example-list'>
          {frameworks.map((framework) => (
            <TabsTrigger className='sd-framework-example-trigger' key={framework} value={frameworkValue(framework)}>
              {framework}
            </TabsTrigger>
          ))}
        </TabsList>
        <span className='sd-framework-example-file'>{filenames.get(selected)}</span>
        <button
          aria-label={copied ? 'Copied' : 'Copy code'}
          aria-live='polite'
          className='sd-framework-example-copy'
          onClick={() => void copyActiveExample()}
          title={copied ? 'Copied' : 'Copy code'}
          type='button'
        >
          {copied ? <Check aria-hidden='true' /> : <Clipboard aria-hidden='true' />}
        </button>
      </div>
      {children}
    </Tabs>
  );
}

export function FrameworkExample({ children, filename, framework }: FrameworkExampleProps) {
  return (
    <TabsContent
      className='sd-framework-example-panel'
      data-filename={filename}
      data-framework-example={frameworkValue(framework)}
      value={frameworkValue(framework)}
    >
      {children}
    </TabsContent>
  );
}
