import sanitizeHtml from "sanitize-html";
import { IFRAME_HOSTS } from "@/lib/config";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li",
    "blockquote", "hr", "img", "figure", "figcaption", "table", "thead", "tbody", "tr", "th", "td",
    "iframe", "div", "span", "code", "pre",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    iframe: ["src", "width", "height", "allowfullscreen", "frameborder", "allow"],
    td: ["colspan", "rowspan"],
    th: ["colspan", "rowspan"],
    div: ["data-youtube-video", "class", "data-related"],
    figure: ["class"],
    p: ["class"],
  },
  allowedSchemes: ["https", "http", "mailto"],
  allowedSchemesByTag: { img: ["https", "http", "data"] },
  allowedIframeHostnames: IFRAME_HOSTS,
  allowIframeRelativeUrls: false,
  transformTags: {
    a: (tagName, attribs) => {
      const external = /^https?:\/\//.test(attribs.href ?? "");
      return { tagName, attribs: external ? { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" } : attribs };
    },
  },
};

/** Sanitize HTML đầu ra của trình soạn thảo; ảnh có `title` được bọc thành figure + figcaption. */
export function sanitizeContent(html: string): string {
  const clean = sanitizeHtml(html, OPTIONS);
  return clean.replace(/<img([^>]*?)title="([^"]*)"([^>]*)>/g, (_m, before: string, caption: string, after: string) => {
    return `<figure class="content-figure"><img${before}title="${caption}"${after}><figcaption>${caption}</figcaption></figure>`;
  });
}

/** Danh sách ảnh trong nội dung thiếu alt hoặc chú thích (title). */
export function imagesMissingMeta(html: string): number {
  const imgs = html.match(/<img[^>]*>/g) ?? [];
  return imgs.filter((tag) => !/alt="[^"]+"/.test(tag) || !/title="[^"]+"/.test(tag)).length;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function countWords(html: string): number {
  const text = stripHtml(html);
  return text ? text.split(" ").length : 0;
}
