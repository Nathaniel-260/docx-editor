import type { Config, SuperDoc, ViewingOptions, ViewingTrackedChangesMode } from 'superdoc';

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false;
type Expect<Value extends true> = Value;

const mode: ViewingTrackedChangesMode = 'markup';
const options: ViewingOptions = { comments: true, trackedChanges: mode };
const config: Config = { selector: '#editor', documentMode: 'viewing', viewing: options };

type SetViewingOptionsParameters = Parameters<SuperDoc['setViewingOptions']>;
type SetViewingOptionsReturn = ReturnType<SuperDoc['setViewingOptions']>;
type _Parameters = Expect<Equal<SetViewingOptionsParameters, [options: ViewingOptions]>>;
type _Return = Expect<Equal<SetViewingOptionsReturn, void>>;

const invalidConfig: Config = {
  selector: '#editor',
  viewing: {
    // @ts-expect-error `review` is the internal renderer term. Public config uses `markup`.
    trackedChanges: 'review',
  },
};

void [config, invalidConfig];
