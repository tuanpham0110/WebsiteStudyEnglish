import type { WordMatch } from '@/lib/text-compare';

/** Colour-coded word alignment: matched, misrecognised, missing and extra words. */
export function AlignmentView({ alignment }: { alignment: WordMatch[] }) {
  return (
    <p className="flex flex-wrap gap-x-1.5 gap-y-1 text-sm">
      {alignment.map((a, i) =>
        a.kind === 'match' ? (
          <span key={i} className="text-success">
            {a.expected}
          </span>
        ) : a.kind === 'substitution' ? (
          <span key={i} className="rounded bg-warning-soft px-1 text-warning" title={`Nghe thành: ${a.heard}`}>
            {a.expected} <span className="text-xs opacity-80">({a.heard})</span>
          </span>
        ) : a.kind === 'missing' ? (
          <span key={i} className="rounded bg-danger-soft px-1 text-danger line-through" title="Bị thiếu">
            {a.expected}
          </span>
        ) : (
          <span key={i} className="text-muted italic" title="Thừa">
            +{a.heard}
          </span>
        ),
      )}
    </p>
  );
}
