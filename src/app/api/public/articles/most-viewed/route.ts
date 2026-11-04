import { getMostViewed } from "@/lib/repo/public";
import { json, serializeCard } from "../../_serialize";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await getMostViewed(10, 3);
  return json({ items: items.map(serializeCard) }, 300);
}
