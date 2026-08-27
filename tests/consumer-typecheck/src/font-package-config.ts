/** Consumer typecheck: the separately packed font bundle composes with packed SuperDoc. */
import {
  createSuperDocFonts,
  resolveBundledFontAssetUrl,
  superdocFonts,
  type BundledFontFamilyName,
  type SuperDocFontsConfig,
} from '@superdoc/fonts';
import type { Config } from 'superdoc';

const directConfig: Config['fonts'] = superdocFonts;
const bundledFamily: BundledFontFamilyName = 'Calibri';
const curatedConfig: Config['fonts'] = createSuperDocFonts({ include: [bundledFamily] });

declare const declaredConfig: SuperDocFontsConfig;
const structuralConfig: Config['fonts'] = declaredConfig;
const resolver: NonNullable<NonNullable<Config['fonts']>['resolveAssetUrl']> = resolveBundledFontAssetUrl;

void [directConfig, curatedConfig, structuralConfig, resolver];
