/** Consumer typecheck for the canonical ruler configuration and margin-change event. */
import type { Config, RulerConfig, SuperDoc, SuperDocPageMarginsChangePayload } from 'superdoc';

declare const rulerElement: HTMLElement;
declare const superdoc: SuperDoc;

const _selectorConfig: RulerConfig = { container: '#ruler' };
const _elementConfig: RulerConfig = { container: rulerElement };

const _canonicalConfig: Config = {
  selector: '#editor',
  measurementUnit: 'cm',
  ui: { ruler: _selectorConfig },
  onPageMarginsChange: (event) => {
    const _documentId: string = event.documentId;
    const _sectionId: string = event.sectionId;
    const _side: 'left' | 'right' = event.side;
    const _valueInInches: number = event.value;
    const _leftInInches: number | undefined = event.pageMargins.left;
    void [_documentId, _sectionId, _side, _valueInInches, _leftInInches];
  },
};

const _booleanConfig: Config = {
  selector: '#editor',
  ui: { ruler: true },
};

const _invalidConfig: Config = {
  selector: '#editor',
  // @ts-expect-error `containr` is not a ruler option.
  ui: { ruler: { containr: '#ruler' } },
};

superdoc.on('page-margins-change', (event) => {
  const _event: SuperDocPageMarginsChangePayload = event;
  void _event;
});
superdoc.toggleRuler();

void [_elementConfig, _canonicalConfig, _booleanConfig, _invalidConfig];
