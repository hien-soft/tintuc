import { absoluteUrl } from "@/lib/seo";

/** Liên kết chia sẻ tĩnh (không cần script bên thứ ba). */
export function ShareLinks({ path, title, label }: { path: string; title: string; label: string }) {
  const url = encodeURIComponent(absoluteUrl(path));
  const text = encodeURIComponent(title);
  const links = [
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${url}`, short: "f" },
    { name: "X", href: `https://twitter.com/intent/tweet?url=${url}&text=${text}`, short: "X" },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`, short: "in" },
    { name: "Email", href: `mailto:?subject=${text}&body=${url}`, short: "@" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-bold text-ink-soft">{label}:</span>
      {links.map((l) => (
        <a
          key={l.name}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          title={`${label} ${l.name}`}
          aria-label={`${label} ${l.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 text-xs font-bold text-ink-soft hover:border-brand hover:bg-brand hover:text-white"
        >
          {l.short}
        </a>
      ))}
    </div>
  );
}
