import { diffWords } from "diff";
import { stripHtml } from "@/lib/content/sanitize";

export interface DiffPart {
  value: string;
  added?: boolean;
  removed?: boolean;
}

export interface FieldDiff {
  field: string;
  parts: DiffPart[];
  changed: boolean;
}

export interface Comparable {
  title?: string | null;
  sapo?: string | null;
  contentHtml?: string | null;
}

/** So sánh văn bản (bỏ thẻ HTML) giữa hai phiên bản theo từng trường. */
export function diffArticles(before: Comparable, after: Comparable): FieldDiff[] {
  const fields: [string, string, string][] = [
    ["Tiêu đề", before.title ?? "", after.title ?? ""],
    ["Sapo", before.sapo ?? "", after.sapo ?? ""],
    ["Nội dung", stripHtml(before.contentHtml ?? ""), stripHtml(after.contentHtml ?? "")],
  ];
  return fields.map(([field, a, b]) => {
    const parts = diffWords(a, b).map((p) => ({ value: p.value, added: p.added, removed: p.removed }));
    return { field, parts, changed: parts.some((p) => p.added || p.removed) };
  });
}
