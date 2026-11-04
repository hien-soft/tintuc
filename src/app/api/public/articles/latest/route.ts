import type { NextRequest } from "next/server";
import { getLatest } from "@/lib/repo/public";
import { intParam, json, serializeCard } from "../../_serialize";

export async function GET(req: NextRequest) {
  const limit = intParam(req.nextUrl.searchParams.get("limit"), 20, 50);
  const items = await getLatest(limit);
  return json({ items: items.map(serializeCard) });
}
