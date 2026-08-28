import { contentControlPatterns } from '@/lib/content-control-patterns';

export function ContentControlPatterns() {
  return (
    <figure className='sd-content-control-patterns'>
      <figcaption>Three content-control shapes</figcaption>
      <div className='sd-content-control-pattern-grid'>
        {contentControlPatterns.map((pattern) => (
          <section key={pattern.id}>
            <div
              className={`sd-content-control-pattern-preview sd-content-control-pattern-${pattern.id}`}
              aria-hidden='true'
            >
              {pattern.id === 'inline' ? (
                <p>
                  Client: <mark>Acme Inc.</mark>
                </p>
              ) : null}
              {pattern.id === 'block' ? (
                <div>
                  <strong>Confidentiality</strong>
                  <span>Each party protects the other party&apos;s information.</span>
                </div>
              ) : null}
              {pattern.id === 'repeating' ? (
                <div>
                  <span>Service review</span>
                  <span>Security review</span>
                </div>
              ) : null}
            </div>
            <strong>{pattern.label}</strong>
            <span>{pattern.wraps}</span>
            <small>{pattern.use}</small>
          </section>
        ))}
      </div>
    </figure>
  );
}
