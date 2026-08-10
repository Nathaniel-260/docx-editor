import { describe, expect, it } from 'bun:test';

import { compileThemeFromRoot } from './parse-theme.js';
import { parseOoxml } from './parse-xml.js';

describe('compileThemeFromRoot format scheme', () => {
  it('retains line styles in their authored style-matrix order', () => {
    const { root, error } = parseOoxml(`
      <a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:themeElements>
          <a:fmtScheme name="Office">
            <a:fillStyleLst><a:noFill/></a:fillStyleLst>
            <a:lnStyleLst>
              <a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"/>
              <a:ln w="12700" cap="rnd" cmpd="sng" algn="ctr"/>
            </a:lnStyleLst>
            <a:bgFillStyleLst/>
          </a:fmtScheme>
        </a:themeElements>
      </a:theme>
    `);

    expect(error).toBeUndefined();
    const lineStyles = compileThemeFromRoot(root).formatScheme?.lineStyles;
    expect(lineStyles).toHaveLength(2);
    expect(lineStyles?.[0]).toContain('cap="flat"');
    expect(lineStyles?.[1]).toContain('cap="rnd"');
  });
});
