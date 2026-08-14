import type { Config } from 'superdoc';
import Typo from 'typo-js';
import enUsAff from 'typo-js/dictionaries/en_US/en_US.aff?raw';
import enUsDic from 'typo-js/dictionaries/en_US/en_US.dic?raw';

type ProofingProvider = NonNullable<NonNullable<Config['proofing']>['provider']>;
type ProofingIssue = Awaited<ReturnType<ProofingProvider['check']>>['issues'][number];

const dictionary = new Typo('en_US', enUsAff, enUsDic);
const wordPattern = /[\p{L}]+(?:['’][\p{L}]+)*/gu;

export const englishProofingProvider: ProofingProvider = {
  id: 'local-english-proofing',
  check: async ({ segments, maxSuggestions = 3, signal }) => {
    const issues: ProofingIssue[] = [];
    let wordsSinceYield = 0;

    for (const segment of segments) {
      signal?.throwIfAborted();

      for (const match of segment.text.matchAll(wordPattern)) {
        const word = match[0];
        const dictionaryWord = word.replaceAll('’', "'");
        const misspelled = !dictionary.check(dictionaryWord);
        if (misspelled) {
          issues.push({
            segmentId: segment.id,
            start: match.index,
            end: match.index + word.length,
            kind: 'spelling',
            message: `“${word}” is not in the English dictionary`,
            replacements: dictionary.suggest(dictionaryWord, maxSuggestions),
          });
        }

        wordsSinceYield += 1;
        if (misspelled || wordsSinceYield === 50) {
          await new Promise((resolve) => setTimeout(resolve, 0));
          signal?.throwIfAborted();
          wordsSinceYield = 0;
        }
      }
    }

    return { issues };
  },
};
