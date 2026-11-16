import { useState } from "react";
import { auctionCategories } from "../categories";
import type { Filters, Language, Translate } from "../types";

export function CategoryTree({
  filters,
  language,
  t,
  onChoose,
}: {
  filters: Filters;
  language: Language;
  t: Translate;
  onChoose: (classId: number | null, subclassId: number | null) => void;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const selected = auctionCategories.find(
    (category) => category.id === filters.classId,
  );
  const child = selected?.children.find(([id]) => id === filters.subclassId);
  const label = selected
    ? language === "ru"
      ? selected.ru
      : selected.en
    : t("All items", "Все предметы");
  const toggle = (id: number) =>
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <details className="category-browser" open>
      <summary>{t("Categories", "Категории")}</summary>
      <div
        className="category-path"
        aria-label={t("Selected category", "Выбранная категория")}
      >
        <span>
          {child ? (
            <button
              className="category-breadcrumb quiet"
              aria-label={t(`All ${label}`, `Все: ${label}`)}
              onClick={() => onChoose(selected!.id, null)}
            >
              {label}
            </button>
          ) : (
            label
          )}
          {child ? ` / ${t(child[2], child[1])}` : ""}
        </span>
        {selected && (
          <button
            className="quiet"
            aria-label={t("Clear category", "Сбросить категорию")}
            onClick={() => onChoose(null, null)}
          >
            ×
          </button>
        )}
      </div>
      <nav aria-label={t("Item categories", "Категории предметов")}>
        <button
          className={`category-choice ${!selected ? "active" : ""}`}
          aria-pressed={!selected}
          onClick={() => onChoose(null, null)}
        >
          {t("All items", "Все предметы")}
        </button>
        {auctionCategories.map((category) => {
          const name = language === "ru" ? category.ru : category.en;
          const open = expanded.has(category.id);
          const active = filters.classId === category.id;
          return (
            <div
              className={`category-group ${active ? "selected-group" : ""}`}
              key={category.id}
            >
              <button
                className={`category-choice category-parent ${active && filters.subclassId == null ? "active" : ""}`}
                aria-pressed={active && filters.subclassId == null}
                aria-expanded={open}
                aria-controls={`category-${category.id}`}
                onClick={() => {
                  if (!active) onChoose(category.id, null);
                  toggle(category.id);
                }}
              >
                <span>{name}</span>
                <span className="category-indicator" aria-hidden="true">
                  {open ? "−" : "+"}
                </span>
              </button>
              <div
                id={`category-${category.id}`}
                className="category-children"
                hidden={!open}
              >
                {category.children.map(([id, ru, en]) => (
                  <button
                    key={id}
                    className={`category-choice ${active && filters.subclassId === id ? "active" : ""}`}
                    aria-pressed={active && filters.subclassId === id}
                    onClick={() => onChoose(category.id, id)}
                  >
                    {t(en, ru)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </nav>
    </details>
  );
}
