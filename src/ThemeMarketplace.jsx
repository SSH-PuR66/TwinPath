import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Download, Sparkles } from "lucide-react";
import { ThemePreview } from "./ThemeScene";
import { shopThemes } from "./themeCatalog";

const PAGE_SIZE = 12;

export default function ThemeMarketplace({ themeKey, onSelectTheme, motionOff }) {
  const [pack, setPack] = useState("All packs");
  const [page, setPage] = useState(0);
  const entries = useMemo(() => Object.entries(shopThemes), []);
  const packs = useMemo(
    () => ["All packs", ...new Set(entries.map(([, theme]) => theme.pack))],
    [entries],
  );
  const filtered = useMemo(
    () => pack === "All packs"
      ? entries
      : entries.filter(([, theme]) => theme.pack === pack),
    [entries, pack],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleThemes = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [pack]);

  return (
    <section className="theme-shop" aria-labelledby="theme-shop-title">
      <header>
        <div>
          <span className="eyebrow">THEME SHOP</span>
          <h3 id="theme-shop-title">{entries.length} extra live themes, ready now</h3>
          <p>
            Every theme is packaged with TwinPath and applies instantly—no pop-ups,
            third-party scripts, accounts, or downloads from an unknown source.
          </p>
        </div>
        <Sparkles aria-hidden="true" size={28} />
      </header>

      <div className="theme-shop-safety">
        <Download aria-hidden="true" size={17} />
        <span>
          Theme packs contain visual styling only. They cannot access household data,
          bank connections, files, or sign-in sessions.
        </span>
      </div>

      <div className="theme-shop-toolbar" aria-label="Theme pack filters">
        <div className="theme-pack-tabs" role="tablist" aria-label="Theme collections">
          {packs.map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={pack === item}
              className={pack === item ? "active" : ""}
              onClick={() => setPack(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <small>{filtered.length} themes in this collection</small>
      </div>

      <div className="theme-shop-grid">
        {visibleThemes.map(([key, theme]) => {
          const selected = themeKey === key;
          return (
            <article className={`theme-shop-card ${selected ? "active" : ""}`} key={key}>
              <ThemePreview themeKey={key} motionOff={motionOff} />
              <div className="theme-shop-card-copy">
                <span>{theme.pack}</span>
                <strong>{theme.name}</strong>
                <small>{theme.description}</small>
                <button type="button" onClick={() => onSelectTheme(key)}>
                  {selected ? <Check size={16} /> : <Sparkles size={16} />}
                  {selected ? "Applied" : "Apply theme"}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <nav className="theme-shop-pagination" aria-label="Theme shop pages">
        <button
          type="button"
          onClick={() => setPage((current) => Math.max(0, current - 1))}
          disabled={page === 0}
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <span>Page {page + 1} of {pageCount}</span>
        <button
          type="button"
          onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))}
          disabled={page >= pageCount - 1}
        >
          Next <ChevronRight size={16} />
        </button>
      </nav>
    </section>
  );
}
