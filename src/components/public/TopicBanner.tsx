import Link from "next/link";
import { topicUrl, type PublicLocale } from "@/lib/urls";

// Gradient theo bảng màu design system: royal · navy · sky · cam
const GRADIENTS = ["from-[#0B3FD6] to-[#1E8BFF]", "from-[#061454] to-[#0B2C9F]", "from-[#0574D6] to-[#0A9BFC]", "from-[#EE5D12] to-[#FBA82A]"];

/** Banner chuyên đề: dùng ảnh banner nếu có, nếu không thì nền gradient + tên. */
export function TopicBanner({ topic, locale, index = 0, subtitle }: { topic: { id: number; slug: string; name: string; bannerUrl: string | null }; locale: PublicLocale; index?: number; subtitle?: string }) {
  return (
    <Link href={topicUrl(topic, locale)} className="group relative block aspect-[5/2] overflow-hidden rounded-2xl">
      {topic.bannerUrl ? (
        <img src={topic.bannerUrl} alt={topic.name} loading="lazy" className="h-full w-full object-cover transition duration-300 ease-ds group-hover:scale-[1.03]" />
      ) : (
        <span className={`flex h-full w-full flex-col justify-center bg-gradient-to-r ${GRADIENTS[index % GRADIENTS.length]} px-6 text-white`}>
          <span className="mb-1.5 inline-flex h-6 w-fit items-center rounded-full bg-white/20 px-2.5 text-[11px] font-bold backdrop-blur">Chuyên đề</span>
          <span className="text-xl font-bold leading-tight sm:text-2xl">{topic.name}</span>
          {subtitle && <span className="mt-1 line-clamp-1 text-xs opacity-90">{subtitle}</span>}
        </span>
      )}
    </Link>
  );
}
