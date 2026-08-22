'use client';

import { DynamicCodeBlock } from 'fumadocs-ui/components/dynamic-codeblock';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'fumadocs-ui/components/ui/tabs';

const modes = [
  {
    id: 'built-in',
    label: 'Built-in',
    applicationToolbar: false,
    applicationComments: false,
    caption: 'SuperDoc renders the toolbar and comments shown here.',
    code: `{
  toolbar: { container: '#toolbar' },
}`,
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    applicationToolbar: false,
    applicationComments: true,
    caption: 'Your application renders comments; SuperDoc keeps the toolbar.',
    code: `{
  toolbar: { container: '#toolbar' },
  comments: false,
}`,
  },
  {
    id: 'fully-custom',
    label: 'Fully custom',
    applicationToolbar: true,
    applicationComments: true,
    caption: 'Your application renders every control; SuperDoc keeps the document.',
    code: 'false',
  },
] as const;

function ownershipClass(applicationOwned: boolean) {
  return `sd-cui-arch-panel${applicationOwned ? ' sd-cui-arch-yours' : ''}`;
}

export function InterfaceOwnership() {
  return (
    <figure aria-label='Interface ownership comparison' className='sd-cui-arch sd-interface-ownership'>
      <Tabs className='sd-interface-ownership-tabs' defaultValue='built-in'>
        <TabsList aria-label='Interface approach' className='sd-interface-ownership-list'>
          {modes.map((mode) => (
            <TabsTrigger className='sd-interface-ownership-trigger' key={mode.id} value={mode.id}>
              {mode.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {modes.map((mode) => (
          <TabsContent className='sd-interface-ownership-mode' data-mode={mode.id} key={mode.id} value={mode.id}>
            <div className={`${ownershipClass(mode.applicationToolbar)} sd-cui-arch-toolbar`}>
              <h3>{mode.applicationToolbar ? 'Your toolbar' : 'Toolbar'}</h3>
              <div aria-hidden='true' className='sd-cui-arch-buttons'>
                <span className='sd-cui-arch-btn sd-cui-arch-btn-on' />
                <span className='sd-cui-arch-btn' />
                <span className='sd-cui-arch-btn' />
                <span className='sd-cui-arch-btn' />
              </div>
            </div>

            <div className='sd-cui-arch-row'>
              <div className='sd-cui-arch-editor'>
                <div aria-hidden='true' className='sd-cui-arch-chrome'>
                  <span className='sd-cui-arch-dot' />
                  <span className='sd-cui-arch-dot' />
                  <span className='sd-cui-arch-dot' />
                </div>
                <div aria-hidden='true' className='sd-cui-arch-canvas'>
                  <div className='sd-cui-arch-page'>
                    <span className='sd-cui-arch-line' style={{ width: '85%' }} />
                    <span className='sd-cui-arch-line sd-cui-arch-line-selected' style={{ width: '60%' }} />
                    <span className='sd-cui-arch-line' style={{ width: '92%' }} />
                    <span className='sd-cui-arch-line' style={{ width: '74%' }} />
                  </div>
                </div>
                <p className='sd-cui-arch-caption'>SuperDoc renders the document, layout, selection, and editing</p>
              </div>

              <div className={ownershipClass(mode.applicationComments)}>
                <h3>{mode.applicationComments ? 'Your comments panel' : 'Comments'}</h3>
                <div aria-hidden='true' className='sd-interface-ownership-comment'>
                  <span className='sd-interface-ownership-avatar' />
                  <span className='sd-interface-ownership-comment-lines'>
                    <span className='sd-cui-arch-line' style={{ width: '90%' }} />
                    <span className='sd-cui-arch-line' style={{ width: '65%' }} />
                  </span>
                </div>
              </div>
            </div>

            <DynamicCodeBlock
              code={mode.code}
              codeblock={{ className: 'sd-interface-ownership-code', title: 'Config.ui' }}
              lang='ts'
            />
            <p className='sd-interface-ownership-caption'>{mode.caption}</p>
          </TabsContent>
        ))}
      </Tabs>
    </figure>
  );
}
