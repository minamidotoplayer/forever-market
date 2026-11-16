import { useEffect, useRef, useState } from "react";
import { craftOutputChoices, quoteDepth } from "../lib";
import { searchRecipes } from "../recipes";
import { Money } from "./Common";
import type {
  Basket,
  Catalogue,
  Language,
  Market,
  Recipe,
  Translate,
} from "../types";
interface Props {
  search?: typeof searchRecipes;
  basket: Basket;
  setBasket: (basket: Basket) => void;
  selected: string;
  market: Market | null;
  names: Catalogue;
  onNames: (names: Catalogue) => void;
  t: Translate;
  language: Language;
}
export function BasketPanel({
  search = searchRecipes,
  basket,
  setBasket,
  selected,
  market,
  names,
  onNames,
  t,
  language,
}: Props) {
  const [output, setOutput] = useState("");
  const [count, setCount] = useState(1);
  const [fee, setFee] = useState(5);
  const [query, setQuery] = useState("");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef(0);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  useEffect(() => {
    request.current++;
    setRecipes([]);
    setStatus("");
    setBusy(false);
  }, [language]);
  const entries = Object.entries(basket).filter(
    ([id, qty]) => /^\d+$/.test(id) && Number.isSafeInteger(qty) && qty > 0,
  );
  let cost = 0;
  let missing = false;
  for (const [id, qty] of entries) {
    const quote = quoteDepth(market?.depth?.[id], qty);
    if (quote?.complete) cost += quote.cost;
    else missing = true;
  }
  const choices = craftOutputChoices(selected, output);
  const resultId = choices.includes(output) ? output : choices[0] || "";
  const outputPrice = market?.items[resultId]?.[0];
  const valid =
    entries.length > 0 &&
    !missing &&
    outputPrice != null &&
    Number.isInteger(count) &&
    count > 0 &&
    Number.isFinite(fee) &&
    fee >= 0 &&
    fee <= 100;
  const profit = valid ? outputPrice * count * (1 - fee / 100) - cost : 0;
  const buy = quoteDepth(market?.depth?.[resultId], count);
  async function find() {
    if (!query.trim()) return;
    const token = ++request.current;
    setBusy(true);
    setStatus(t("Searching…", "Поиск…"));
    setRecipes([]);
    try {
      const result = await search(
        query.trim(),
        language === "ru" ? "ruRU" : "enUS",
      );
      if (token !== request.current) return;
      onNames(result.names);
      setRecipes(result.recipes);
      setStatus(
        `${result.recipes.length} ${t("recipes", "рецептов")} · ${result.build}`,
      );
    } catch {
      if (token === request.current)
        setStatus(
          t(
            "Recipe service unavailable. Add ingredients manually.",
            "Сервис рецептов недоступен. Добавьте материалы вручную.",
          ),
        );
    } finally {
      if (token === request.current) setBusy(false);
    }
  }
  return (
    <details className="panel basket-panel" id="shopping-basket">
      <summary className="basket-summary">
        {t("Shopping basket & crafting", "Корзина и крафт")}{" "}
        <span>{entries.length}</span>
      </summary>
      <div className="basket-content">
        {entries.length ? (
          entries.map(([id, qty]) => {
            const quote = quoteDepth(market?.depth?.[id], qty);
            return (
              <div className="basket-row" key={id}>
                <span>{names[id]?.name || `#${id}`}</span>
                <label>
                  {t("Qty", "Кол-во")}{" "}
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    value={qty}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      if (Number.isSafeInteger(value) && value > 0)
                        setBasket({ ...basket, [id]: value });
                    }}
                  />
                </label>
                <strong>
                  <Money value={quote?.complete ? quote.cost : null} />
                </strong>
                <button
                  className="icon-button"
                  aria-label={t("Remove ingredient", "Удалить материал")}
                  onClick={() => {
                    const next = { ...basket };
                    delete next[id];
                    setBasket(next);
                  }}
                >
                  ×
                </button>
              </div>
            );
          })
        ) : (
          <p className="basket-empty">
            {t(
              "Select an item and add it to your basket.",
              "Выберите предмет и добавьте его в корзину.",
            )}
          </p>
        )}
        <p className="basket-total">
          {t("Estimated ingredient cost", "Оценка стоимости материалов")}:{" "}
          <Money value={missing ? null : cost} />
        </p>
      </div>
      <div className="craft-tool">
        <h2>{t("Craft or buy", "Крафт или покупка")}</h2>
        <div className="recipe-browser">
          <form
            className="recipe-search"
            onSubmit={(e) => {
              e.preventDefault();
              find();
            }}
          >
            <input
              aria-label={t("Search recipes", "Поиск рецептов")}
              type="search"
              maxLength={64}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Recipe name…", "Название рецепта…")}
            />
            <button className="button" disabled={busy}>
              {t("Search", "Найти")}
            </button>
          </form>
          <p className="recipe-credit">
            {t(
              "Selecting a recipe replaces the basket. Data:",
              "Выбор рецепта заменяет корзину. Данные:",
            )}{" "}
            <a
              href="https://warcraftforever.com/developers/data/"
              target="_blank"
              rel="noopener"
            >
              Warcraft Forever
            </a>
          </p>
          <p role="status">{status}</p>
          {recipes.map((recipe) => (
            <button
              className="recipe-option"
              key={recipe.id}
              onClick={() => {
                setBasket(
                  Object.fromEntries(
                    recipe.reagents.map(([id, qty]) => [String(id), qty]),
                  ),
                );
                setOutput(String(recipe.product.item));
                setCount(recipe.product.count);
                setRecipes([]);
                setStatus(
                  t(
                    "Recipe ingredients loaded.",
                    "Материалы рецепта добавлены.",
                  ),
                );
              }}
            >
              {recipe.name || `#${recipe.id}`}{" "}
              <span>×{recipe.product.count}</span>
            </button>
          ))}
        </div>
        <p>
          {t(
            "The basket contains ingredients for one craft. Select the output in the listing table.",
            "Корзина содержит материалы на один крафт. Выберите результат в таблице предметов.",
          )}
        </p>
        <label>
          {t("Output item", "Результат")}
          <select value={resultId} onChange={(e) => setOutput(e.target.value)}>
            {choices.map((id) => (
              <option key={id} value={id}>
                {names[id]?.name || `#${id}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("Units per craft", "Штук за крафт")}
          <input
            type="number"
            min="1"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
          />
        </label>
        <label>
          {t("Auction fee, %", "Комиссия, %")}
          <input
            type="number"
            min="0"
            max="100"
            value={fee}
            onChange={(e) => setFee(Number(e.target.value))}
          />
        </label>
        <div role="status">
          {valid ? (
            <>
              <p>
                {t("Craft cost", "Стоимость крафта")}: <Money value={cost} /> ·{" "}
                {t("Buy output", "Купить результат")}:{" "}
                <Money value={buy?.complete ? buy.cost : null} />
              </p>
              <p>
                {t(
                  "Estimated difference after fee",
                  "Примерная разница после комиссии",
                )}
                : {profit < 0 ? "−" : "+"}
                <Money value={Math.abs(profit)} />
              </p>
            </>
          ) : (
            t(
              "Add available ingredients and select an output with a current price.",
              "Добавьте доступные материалы и выберите результат с текущей ценой.",
            )
          )}
        </div>
        <p className="method-note">
          {t(
            "Estimates use current listings and whole stacks. Sales are not guaranteed. Vendor materials, deposits and other crafting costs are excluded.",
            "Оценки используют текущие лоты и целые пачки. Продажа не гарантирована. Материалы у торговца, залог и другие затраты не учтены.",
          )}
        </p>
      </div>
    </details>
  );
}
