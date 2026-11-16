import { memo, useEffect, useMemo, useRef, useState } from "react";
import { CategoryTree } from "./CategoryTree";
import { csvValue, filterItems } from "../lib";
import { Money, ItemIcon, qualityClass } from "./Common";
import type {
  Catalogue,
  Filters,
  Language,
  Market,
  Prices,
  Translate,
} from "../types";
interface Props {
  market: Market | null;
  names: Catalogue;
  selected: string;
  onSelect: (id: string) => void;
  favorites: Set<string>;
  onFavorite: (id: string) => void;
  favoritesOnly: boolean;
  t: Translate;
  language: Language;
  onVisible: (ids: string[]) => void;
}
const Row = memo(function Row({
  id,
  values,
  meta,
  selected,
  favorite,
  onSelect,
  onFavorite,
  t,
}: {
  id: string;
  values: Prices;
  meta?: Catalogue[string];
  selected: boolean;
  favorite: boolean;
  onSelect: Props["onSelect"];
  onFavorite: Props["onFavorite"];
  t: Translate;
}) {
  return (
    <tr
      data-id={id}
      className={selected ? "selected" : ""}
      aria-selected={selected}
      onClick={() => onSelect(id)}
    >
      <td>
        <div className="item-cell">
          <ItemIcon meta={meta} />
          <div className="item-label">
            <button
              title={meta?.name || `${t("Item", "Предмет")} #${id}`}
              className={`item-name quiet ${qualityClass(meta?.quality)}`}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(id);
              }}
            >
              {meta?.name || `${t("Item", "Предмет")} #${id}`}
            </button>
            <span className="item-id">ID {id}</span>
          </div>
        </div>
      </td>
      <td>
        <Money value={values[0]} />
      </td>
      <td>{values[2].toLocaleString()}</td>
      <td>
        <button
          className={`favorite ${favorite ? "saved" : ""}`}
          aria-label={`${t("Favorite", "Избранное")}: ${meta?.name || id}`}
          aria-pressed={favorite}
          onClick={(e) => {
            e.stopPropagation();
            onFavorite(id);
          }}
        >
          {favorite ? "★" : "☆"}
        </button>
      </td>
    </tr>
  );
});
export function Listings({
  market,
  names,
  selected,
  onSelect,
  favorites,
  onFavorite,
  favoritesOnly,
  t,
  language,
  onVisible,
}: Props) {
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA", "SELECT"].includes(tag || "") &&
        !document.querySelector('[role="dialog"]')
      ) {
        event.preventDefault();
        searchInput.current?.focus();
      }
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState("name");
  const [direction, setDirection] = useState(1);
  const [page, setPage] = useState(1);
  // Capture the sorting catalogue only on explicit list actions. Arriving metadata must not move rows under the pointer.
  const sortingNames = useMemo(
    () => names,
    [market, query, filters, sort, direction, favoritesOnly, favorites],
  );
  const entries = useMemo(
    () =>
      filterItems(
        market?.items,
        sortingNames,
        query,
        favorites,
        favoritesOnly,
        sort,
        direction,
        filters,
      ),
    [
      market,
      sortingNames,
      query,
      favorites,
      favoritesOnly,
      sort,
      direction,
      filters,
    ],
  );
  const pages = Math.max(1, Math.ceil(entries.length / 20));
  const activePage = Math.min(page, pages);
  const rows = entries.slice((activePage - 1) * 20, activePage * 20);
  const visibleKey = rows.map(([id]) => id).join(",");
  useEffect(() => {
    onVisible(visibleKey ? visibleKey.split(",") : []);
  }, [visibleKey, onVisible]);
  useEffect(() => setPage(1), [market, favoritesOnly]);
  const changeFilter = (key: keyof Filters, value: string, scale = 1) => {
    setFilters((old) => ({
      ...old,
      [key]: value === "" ? null : Number(value) * scale,
    }));
    setPage(1);
  };
  const chooseCategory = (
    classId: number | null,
    subclassId: number | null,
  ) => {
    setFilters((old) => ({ ...old, classId, subclassId }));
    setPage(1);
  };
  const exportCsv = () => {
    const rows = [
      [
        "item_id",
        "name",
        "min_unit_copper",
        "median_unit_copper",
        "quantity",
        "listings",
        "snapshot_utc",
      ],
      ...entries.map(([id, v]) => [
        id,
        names[id]?.name || id,
        ...v,
        new Date((market?.updatedAt || 0) * 1000).toISOString(),
      ]),
    ];
    const blob = new Blob(
      ["\uFEFF" + rows.map((row) => row.map(csvValue).join(",")).join("\r\n")],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "forever-market.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <section className="panel item-panel">
      <div className="panel-title">
        <h2>
          {favoritesOnly
            ? t("Favorites", "Избранное")
            : t("Auction listings", "Лоты аукциона")}{" "}
          <span>{entries.length.toLocaleString()}</span>
        </h2>
        <button
          className="icon-button"
          onClick={exportCsv}
          disabled={!entries.length}
          aria-label={t("Export CSV", "Скачать CSV")}
        >
          ↓
        </button>
      </div>
      <div className="search-wrap">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          ref={searchInput}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          aria-label={t("Search items", "Поиск предметов")}
          placeholder={t(
            "Item name, partial words or ID…",
            "Название, части слов или ID…",
          )}
        />
      </div>
      <details className="auction-filters">
        <summary>{t("Filters", "Фильтры")}</summary>
        <div className="filter-grid">
          <label>
            {t("Quality", "Качество")}
            <select
              value={filters.quality ?? ""}
              onChange={(e) => changeFilter("quality", e.target.value)}
            >
              <option value="">{t("Any", "Любое")}</option>
              {["Poor", "Common", "Uncommon", "Rare", "Epic", "Legendary"].map(
                (en, i) => (
                  <option key={en} value={i}>
                    {t(
                      en,
                      [
                        "Низкое",
                        "Обычное",
                        "Необычное",
                        "Редкое",
                        "Эпическое",
                        "Легендарное",
                      ][i],
                    )}
                  </option>
                ),
              )}
            </select>
          </label>
          <label>
            {t("Required level", "Требуемый уровень")}
            <div className="filter-range">
              {(["minLevel", "maxLevel"] as const).map((key, i) => (
                <input
                  key={key}
                  type="number"
                  min="0"
                  value={filters[key] ?? ""}
                  onChange={(e) => changeFilter(key, e.target.value)}
                  aria-label={
                    i
                      ? t("Maximum level", "Максимальный уровень")
                      : t("Minimum level", "Минимальный уровень")
                  }
                  placeholder={i ? t("To", "До") : t("From", "От")}
                />
              ))}
            </div>
          </label>
          <label>
            {t("Unit price, gold", "Цена за штуку, золото")}
            <div className="filter-range">
              {(["minPrice", "maxPrice"] as const).map((key, i) => (
                <input
                  key={key}
                  type="number"
                  min="0"
                  step="0.01"
                  value={filters[key] == null ? "" : filters[key]! / 10000}
                  onChange={(e) => changeFilter(key, e.target.value, 10000)}
                  aria-label={
                    i
                      ? t("Maximum price", "Максимальная цена")
                      : t("Minimum price", "Минимальная цена")
                  }
                  placeholder={i ? t("To", "До") : t("From", "От")}
                />
              ))}
            </div>
          </label>
        </div>
        <div className="filter-help">
          <span>
            {t(
              "Categories and levels use known item metadata.",
              "Категории и уровни учитывают известные данные предметов.",
            )}
          </span>
          <button
            className="quiet"
            onClick={() => {
              setFilters({});
              setPage(1);
            }}
          >
            {t("Reset", "Сбросить")}
          </button>
        </div>
      </details>
      <div className="listing-layout">
        <CategoryTree
          filters={filters}
          language={language}
          t={t}
          onChoose={chooseCategory}
        />
        <div className="listing-results">
          <div className="table-scroll">
            <table className="item-table">
              <colgroup>
                <col />
                <col className="price-column" />
                <col className="quantity-column" />
                <col className="favorite-column" />
              </colgroup>
              <thead>
                <tr>
                  {(["name", "price", "volume"] as const).map((key, i) => (
                    <th
                      key={key}
                      aria-sort={
                        sort === key
                          ? direction === 1
                            ? "ascending"
                            : "descending"
                          : "none"
                      }
                    >
                      <button
                        onClick={() => {
                          setSort(key);
                          setDirection(
                            sort === key
                              ? -direction
                              : key === "volume"
                                ? -1
                                : 1,
                          );
                          setPage(1);
                        }}
                      >
                        {
                          [
                            t("Item", "Предмет"),
                            t("Unit price", "Цена за штуку"),
                            t("Quantity", "Количество"),
                          ][i]
                        }{" "}
                        {sort === key ? (direction === 1 ? "↑" : "↓") : "↕"}
                      </button>
                    </th>
                  ))}
                  <th>
                    <span className="sr-only">
                      {t("Favorite", "Избранное")}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map(([id, values]) => (
                  <Row
                    key={id}
                    id={id}
                    values={values}
                    meta={names[id]}
                    selected={selected === id}
                    favorite={favorites.has(id)}
                    onSelect={onSelect}
                    onFavorite={onFavorite}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
            {!rows.length && (
              <div className="empty">
                {t("No matching listings.", "Подходящих лотов нет.")}
              </div>
            )}
          </div>
          <div className="pagination">
            <span>
              {entries.length
                ? `${(activePage - 1) * 20 + 1}–${Math.min(activePage * 20, entries.length)} / ${entries.length}`
                : "0"}
            </span>
            <div>
              <button
                disabled={activePage === 1}
                onClick={() => setPage((p) => p - 1)}
                aria-label={t("Previous page", "Предыдущая страница")}
              >
                ←
              </button>
              <span>
                {activePage} / {pages}
              </span>
              <button
                disabled={activePage === pages}
                onClick={() => setPage((p) => p + 1)}
                aria-label={t("Next page", "Следующая страница")}
              >
                →
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
