/** Bỏ dấu tiếng Việt (gồm đ/Đ). */
export function removeDiacritics(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

export function slugify(input: string, maxLength = 120): string {
  const slug = removeDiacritics(input)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug.length <= maxLength) return slug;
  return slug.slice(0, maxLength).replace(/-[^-]*$/, "") || slug.slice(0, maxLength);
}

/** Tách ID ở cuối chuỗi dạng `{slug}-{id}` hoặc `{slug}-{id}.html`. */
export function parseSlugId(segment: string): { slug: string; id: number } | null {
  const m = /^(.*)-(\d+)(?:\.html)?$/.exec(decodeURIComponent(segment));
  if (!m) return null;
  return { slug: m[1], id: Number(m[2]) };
}
