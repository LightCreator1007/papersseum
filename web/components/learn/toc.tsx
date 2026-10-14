import type { TocItem } from "@/lib/learn/manifest";

export function Toc({ items }: { items: TocItem[] }) {
  if (items.length < 2) return null;
  return (
    <nav className="toc" aria-label="On this page">
      <p className="toc-title">On this page</p>
      <ul>
        {items.map((t) => (
          <li key={t.id} className={t.depth === 3 ? "sub" : undefined}>
            <a href={`#${t.id}`}>{t.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
