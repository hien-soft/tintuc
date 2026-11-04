"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export interface NavLink {
  href: string;
  label: string;
}

interface Props {
  groups: { title: string; links: NavLink[] }[];
  openLabel: string;
  closeLabel: string;
  searchAction: string;
  searchPlaceholder: string;
}

/** Menu dạng ngăn kéo cho màn hình nhỏ. */
export function MobileMenu({ groups, openLabel, closeLabel, searchAction, searchPlaceholder }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={openLabel}
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded text-white hover:bg-white/10 lg:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label={openLabel}>
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <nav className="absolute inset-y-0 left-0 flex w-[85%] max-w-sm flex-col overflow-y-auto bg-white text-ink shadow-xl">
            <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
              <span className="font-bold uppercase">Menu</span>
              <button type="button" onClick={() => setOpen(false)} aria-label={closeLabel} className="flex h-9 w-9 items-center justify-center rounded hover:bg-white/10">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <form action={searchAction} className="flex gap-2 border-b p-3">
              <input
                name="q"
                type="search"
                placeholder={searchPlaceholder}
                className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm focus:border-brand focus:outline-none"
              />
              <button type="submit" className="rounded bg-brand px-3 text-sm font-semibold text-white">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </button>
            </form>
            {groups.map((g) => (
              <div key={g.title} className="border-b py-2">
                <p className="px-4 py-1 text-xs font-bold uppercase text-ink-soft">{g.title}</p>
                <ul className="grid grid-cols-2">
                  {g.links.map((l) => (
                    <li key={l.href + l.label}>
                      <Link href={l.href} className="block px-4 py-2 text-sm hover:bg-brand-light hover:text-brand">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
