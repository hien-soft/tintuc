import Link from "next/link";
import { topicUrl, type PublicLocale } from "@/lib/urls";

const GRADIENTS = ["from-[#8a0e15] to-[#d43a2f]", "from-[#0f3b5f] to-[#1f7a8c]", "from-[#3d2c5e] to-[#8a4f7d]", "from-[#1d4d2b] to-[#4c8c3f]"];

/** Banner chuyên đề: dùng ảnh banner nếu có, nếu không thì nền gradient + tên. */
export function TopicBanner({ topic, locale, index = 0, subtitle }: { topic: { id: number; slug: string; name: string; bannerUrl: string | null }; locale: PublicLocale; index?: number; subtitle?: string }) {
  return (
    <Link href={topicUrl(topic, locale)} className="group relative block aspect-[3/1] overflow-hidden rounded">
      {topic.bannerUrl ? (
        <img src={topic.bannerUrl} alt={topic.name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.02]" />
      ) : (
        <span className={`flex h-full w-full flex-col justify-center bg-gradient-to-r ${GRADIENTS[index % GRADIENTS.length]} px-5 text-white`}>
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] opacity-80">Chuyên đề</span>
          <span className="text-xl font-bold leading-tight sm:text-2xl">{topic.name}</span>
          {subtitle && <span className="mt-1 line-clamp-1 text-xs opacity-90">{subtitle}</span>}
        </span>
      )}
    </Link>
  );
}
