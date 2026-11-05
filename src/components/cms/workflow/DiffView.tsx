import type { FieldDiff } from "@/lib/cms/diff";

export function DiffView({ diffs }: { diffs: FieldDiff[] }) {
  const changed = diffs.filter((d) => d.changed);
  if (changed.length === 0) return <p className="text-sm text-gray-500">Không có khác biệt về tiêu đề, sapo và nội dung.</p>;
  return (
    <div className="space-y-4">
      {changed.map((d) => (
        <div key={d.field}>
          <h4 className="mb-1 text-xs font-semibold tracking-wide text-gray-500">{d.field}</h4>
          <p className="whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-3 text-sm leading-relaxed">
            {d.parts.map((p, i) =>
              p.added ? (
                <ins key={i} className="bg-emerald-100 text-emerald-900 no-underline">{p.value}</ins>
              ) : p.removed ? (
                <del key={i} className="bg-red-100 text-red-800">{p.value}</del>
              ) : (
                <span key={i}>{p.value}</span>
              ),
            )}
          </p>
        </div>
      ))}
    </div>
  );
}
