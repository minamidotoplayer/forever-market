import { useCallback, useEffect, useMemo, useState } from "react";
import { useMarket } from "./hooks/useMarket";
import { useMetadata } from "./hooks/useMetadata";
import { Listings } from "./components/Listings";
import { ItemDetail } from "./components/ItemDetail";
import { BasketPanel } from "./components/BasketPanel";
import { Settings } from "./components/Settings";
import { readStored, writeStored } from "./storage";
import { english } from "./itemNames";
import type { Basket, Catalogue, Language, Translate } from "./types";
export function App() {
  const [language, setLanguage] = useState<Language>(() =>
    readStored<string>("fm-language", "en") === "ru" ? "ru" : "en",
  );
  const t: Translate = useCallback(
    (en, ru) => (language === "en" ? en : ru),
    [language],
  );
  const [source, setSource] = useState(() => readStored("fm-source", ""));
  const [demo, setDemo] = useState(false);
  const data = useMarket(source, demo);
  const [selected, setSelected] = useState(
    () => new URLSearchParams(location.search).get("item") || "13463",
  );
  const selectedId = data.market?.items[selected]
    ? selected
    : Object.keys(data.market?.items || {})[0] || "";
  const [favorites, setFavorites] = useState(
    () => new Set<string>(readStored<string[]>("fm-favorites", [])),
  );
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [basket, setBasket] = useState<Basket>(() =>
    readStored("fm-basket", {}),
  );
  const [settings, setSettings] = useState(false);
  const [visible, setVisible] = useState<string[]>([]);
  const onVisible = useCallback(
    (ids: string[]) =>
      setVisible((old) => (old.join(",") === ids.join(",") ? old : ids)),
    [],
  );
  const metadataIds = useMemo(
    () => [...visible, selectedId],
    [visible, selectedId],
  );
  useMetadata(metadataIds, data.names, data.setNames, data.isDemo, data.index);
  const names = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(data.names).map(([id, item]) => {
          const localized = item.localizedNames?.[language] || item.name;
          const name =
            language === "en" && /[А-Яа-яЁё]/.test(localized)
              ? english(localized)
              : localized;
          return [
            id,
            {
              ...item,
              name:
                language === "en" && /[А-Яа-яЁё]/.test(name)
                  ? `Item #${id}`
                  : name,
            },
          ];
        }),
      ),
    [data.names, language],
  );
  const favorite = useCallback(
    (id: string) =>
      setFavorites((old) => {
        const next = new Set(old);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      }),
    [],
  );
  const addNames = useCallback(
    (incoming: Catalogue) =>
      data.setNames((old) => {
        const next = { ...old };
        for (const [id, item] of Object.entries(incoming))
          next[id] = {
            ...old[id],
            name: language === "en" ? item.name : old[id]?.name || item.name,
            localizedNames: {
              ...old[id]?.localizedNames,
              [language]: item.name,
            },
          };
        return next;
      }),
    [data.setNames, language],
  );
  useEffect(() => {
    document.documentElement.lang = language;
    document.title =
      language === "en"
        ? "Forever Market · WoW Auction"
        : "Forever Market · Аукцион WoW";
    writeStored("fm-language", language);
  }, [language]);
  useEffect(() => writeStored("fm-favorites", [...favorites]), [favorites]);
  useEffect(() => writeStored("fm-basket", basket), [basket]);
  useEffect(() => writeStored("fm-source", source), [source]);
  useEffect(() => {
    if (!data.current.region || !data.current.rule) return;
    const params = new URLSearchParams({
      region: data.current.region.id,
      ruleset: String(data.current.rule.id),
      house: String(data.current.house?.id || ""),
    });
    if (selectedId) params.set("item", selectedId);
    window.history.replaceState(null, "", `${location.pathname}?${params}`);
  }, [data.current, selectedId]);
  const region = data.current.region,
    rule = data.current.rule,
    house = data.current.house;
  const houseName = (name: string) =>
    language === "ru"
      ? (
          {
            "Alliance Auction House": "Аукцион Альянса",
            "Horde Auction House": "Аукцион Орды",
            "Blackwater Auction House": "Аукцион Чёрноводья",
          } as Record<string, string>
        )[name] || name
      : name;
  const stats = useMemo(
    () => Object.values(data.market?.items || {}),
    [data.market],
  );
  const stale =
    data.market && Date.now() / 1000 - data.market.updatedAt > 10800;
  return (
    <div className="app-shell">
      <header className="sidebar">
        <a className="brand" href="./">
          <span>
            FOREVER MARKET<small>WORLD OF WARCRAFT · AUCTION HOUSE</small>
          </span>
        </a>
        <nav aria-label={t("Main navigation", "Основная навигация")}>
          <button
            className={`nav-item ${!favoritesOnly ? "active" : ""}`}
            onClick={() => setFavoritesOnly(false)}
          >
            {t("Browse auctions", "Аукцион")}
          </button>
          <button
            className={`nav-item ${favoritesOnly ? "active" : ""}`}
            onClick={() => setFavoritesOnly(true)}
          >
            ☆ {t("Favorites", "Избранное")}{" "}
            <span className="fav-count">{favorites.size}</span>
          </button>
        </nav>
        <select
          className="language-switch"
          aria-label="Language"
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
        >
          <option value="en">EN</option>
          <option value="ru">RU</option>
        </select>
      </header>
      <main>
        <div className="content">
          <section
            className="market-picker"
            aria-label={t("Market selection", "Выбор рынка")}
          >
            <label>
              <span>{t("REGION", "РЕГИОН")}</span>
              <select
                value={region?.id || ""}
                disabled={!data.index.regions.length}
                onChange={(e) =>
                  data.setSelection((old) => ({
                    ...old,
                    region: e.target.value,
                  }))
                }
              >
                {data.index.regions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {(
                      {
                        eu: t("Europe", "Европа"),
                        us: t("Americas", "Америка"),
                        kr: t("Korea", "Корея"),
                        tw: t("Taiwan", "Тайвань"),
                      } as Record<string, string>
                    )[r.id] || r.id}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{t("RULESET", "РУЛСЕТ")}</span>
              <select
                value={rule?.id || ""}
                disabled={!region}
                onChange={(e) =>
                  data.setSelection((old) => ({
                    ...old,
                    ruleset: e.target.value,
                  }))
                }
              >
                {region?.rulesets.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="house-picker">
              <span>{t("AUCTION HOUSE", "АУКЦИОН")}</span>
              <select
                value={house?.id || ""}
                disabled={!rule?.houses.length}
                onChange={(e) =>
                  data.setSelection((old) => ({
                    ...old,
                    house: e.target.value,
                  }))
                }
              >
                {rule?.houses.map((h) => (
                  <option key={h.id} value={h.id}>
                    {houseName(h.name)}
                  </option>
                ))}
              </select>
            </label>
            <div className="feed-status">
              <span className="dot" />
              {data.loading
                ? t("Loading…", "Загрузка…")
                : data.market
                  ? `${stale ? t("Stale · ", "Старый снимок · ") : ""}${new Date(data.market.updatedAt * 1000).toLocaleString(language, { timeZone: "UTC", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} UTC`
                  : t("No snapshot", "Нет снимка")}
            </div>
            <button
              className="button refresh"
              disabled={data.loading}
              onClick={data.refresh}
              aria-label={t("Refresh market", "Обновить рынок")}
            >
              ↻
            </button>
          </section>
          {data.isDemo && (
            <div className="notice" role="status">
              {t(
                "Demo: all prices and history are fictional.",
                "Демо: все цены и история вымышлены.",
              )}
              <button
                onClick={() => {
                  setDemo(false);
                  data.refresh();
                }}
              >
                {t("Load live data", "Загрузить реальные данные")}
              </button>
            </div>
          )}
          {data.error && (
            <div className="notice" role="alert">
              {t("Data error", "Ошибка данных")}: {data.error}
              <button onClick={() => setSettings(true)}>
                {t("Settings", "Настройки")}
              </button>
            </div>
          )}
          <section
            className="overview"
            aria-label={t("Market totals", "Статистика рынка")}
          >
            {[
              t("ITEMS", "ПРЕДМЕТЫ"),
              t("LISTINGS", "ЛОТЫ"),
              t("UNITS", "КОЛИЧЕСТВО"),
            ].map((label, i) => (
              <div key={label}>
                <span className="stat-label">{label}</span>
                <strong>
                  {data.market
                    ? [
                        stats.length,
                        stats.reduce((sum, v) => sum + v[3], 0),
                        stats.reduce((sum, v) => sum + v[2], 0),
                      ][i].toLocaleString()
                    : "—"}
                </strong>
              </div>
            ))}
          </section>
          <div className="workspace">
            <Listings
              market={data.market}
              names={names}
              selected={selectedId}
              onSelect={setSelected}
              favorites={favorites}
              onFavorite={favorite}
              favoritesOnly={favoritesOnly}
              t={t}
              language={language}
              onVisible={onVisible}
            />
            <ItemDetail
              id={selectedId}
              names={names}
              market={data.market}
              history={data.history}
              favorite={favorites.has(selectedId)}
              onFavorite={() => favorite(selectedId)}
              onAdd={() => {
                if (selectedId)
                  setBasket((old) => ({
                    ...old,
                    [selectedId]: (old[selectedId] || 0) + 1,
                  }));
              }}
              t={t}
              language={language}
            />
          </div>
          <BasketPanel
            basket={basket}
            setBasket={setBasket}
            selected={selectedId}
            market={data.market}
            names={names}
            onNames={addNames}
            t={t}
            language={language}
          />
          <footer>
            <span>
              FOREVER MARKET ·{" "}
              {t("Independent fan project", "Независимый фан-проект")}
            </span>
            <button className="quiet" onClick={() => setSettings(true)}>
              {t("Data settings", "Настройки данных")}
            </button>
          </footer>
        </div>
      </main>
      {settings && (
        <Settings
          source={source}
          t={t}
          onClose={() => setSettings(false)}
          onSave={(value) => {
            setSource(value);
            setDemo(false);
            data.refresh();
            setSettings(false);
          }}
          onDemo={() => {
            setDemo(true);
            setSettings(false);
          }}
        />
      )}
    </div>
  );
}
