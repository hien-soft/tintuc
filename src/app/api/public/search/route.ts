import type { NextRequest } from "next/server";
import { searchArticles } from "@/lib/repo/public";
import { intParam, json, serializeCard } from "../_serialize";

function day(value: string | null, end: boolean): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** `?q=&source=&from=yyyy-mm-dd&to=yyyy-mm-dd&page=` — tìm kiếm không phân biệt dấu. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = await searchArticles({
    q: sp.get("q")?.slice(0, 200) || undefined,
    source: sp.get("source")?.slice(0, 100) || undefined,
    from: day(sp.get("from"), false),
    to: day(sp.get("to"), true),
    page: intParam(sp.get("page"), 1, 1000),
  });
  return json({ page: result.page, pages: result.pages, total: result.total, items: result.items.map(serializeCard) }, 30);
}
