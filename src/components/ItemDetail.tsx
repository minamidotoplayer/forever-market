import { useEffect, useId, useMemo, useState } from "react";
import { bestHours, historyPoints, moneyText, quoteDepth } from "../lib";
import { Money, ItemIcon, qualityClass } from "./Common";
import type {
  Catalogue,
  Language,
  Market,
  Point,
  PriceHistory,
  Translate,
} from "../types";
function Chart({
  points,
  metric,
  days,
  language,
  t,
}: {
  points: Point[];
  metric: number;
  days: number;
  language: Language;
  t: Translate;
}) {
  const [hover, setHover] = useState<Point | null>(null);
  const gradient = useId();
  useEffect(() => setHover(null), [points, metric]);
  const usable = points.filter(
    (p) => p.values && Number.isFinite(p.values[metric]),
  );
  if (!usable.length)
    return (
      <div className="chart">
        <div className="empty">
          {t(
            "History will appear after successful snapshots.",
            "История появится после успешных снимков.",
          )}
        </div>
      </div>
    );
  const W = 440,
    H = 216,
    L = 55,
    R = 12,
    T = 15,
    B = 30;
  const values = usable.map((p) => p.values![metric]);
  const low = Math.min(...values),
    high = Math.max(...values),
    pad = Math.max((high - low) * 0.25, high * 0.025, 1),
    min = Math.max(0, low - pad),
    max = high + pad;
  const first = usable[0].time,
    last = usable.at(-1)!.time;
  const x = (time: number) =>
    last === first
      ? (L + W - R) / 2
      : L + ((time - first) / (last - first)) * (W - L - R);
  const y = (value: number) =>
    T + (1 - (value - min) / (max - min)) * (H - T - B);
  const segments: Point[][] = [];
  let segment: Point[] = [];
  for (const point of points) {
    if (
      !point.values ||
      !Number.isFinite(point.values[metric]) ||
      (segment.length &&
        point.time - segment.at(-1)!.time > (days <= 7 ? 5400 : 129600))
    ) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    if (point.values && Number.isFinite(point.values[metric]))
      segment.push(point);
  }
  if (segment.length) segments.push(segment);
  const ticks =
    usable.length === 1
      ? [usable[0]]
      : [
          usable[0],
          usable[Math.floor((usable.length - 1) / 2)],
          usable.at(-1)!,
        ];
  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={t("Price history", "История цен")}
        onPointerLeave={() => setHover(null)}
        onPointerMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const pos = ((event.clientX - rect.left) / rect.width) * W;
          setHover(
            usable.reduce((best, p) =>
              Math.abs(x(p.time) - pos) < Math.abs(x(best.time) - pos)
                ? p
                : best,
            ),
          );
        }}
      >
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d7aa58" stopOpacity=".35" />
            <stop offset="100%" stopColor="#d7aa58" stopOpacity=".02" />
          </linearGradient>
        </defs>
        {Array.from({ length: 4 }, (_, i) => {
          const value = min + ((max - min) * i) / 3;
          return (
            <g key={i}>
              <line
                className="grid-line"
                x1={L}
                x2={W - R}
                y1={y(value)}
                y2={y(value)}
              />
              <text x={L - 7} y={y(value) + 3} textAnchor="end">
                {value >= 10000
                  ? `${(value / 10000).toFixed(1)}g`
                  : value >= 100
                    ? `${(value / 100).toFixed(0)}s`
                    : `${value.toFixed(0)}c`}
              </text>
            </g>
          );
        })}
        {segments.map((part, i) => {
          const line = part
            .map(
              (p, j) => `${j ? "L" : "M"}${x(p.time)},${y(p.values![metric])}`,
            )
            .join(" ");
          return (
            <g key={i}>
              <path
                d={`${line} L${x(part.at(-1)!.time)},${H - B} L${x(part[0].time)},${H - B} Z`}
                fill={`url(#${gradient})`}
              />
              <path className="line" d={line} />
              {part.length === 1 && (
                <circle
                  className="dot-point"
                  r="3"
                  cx={x(part[0].time)}
                  cy={y(part[0].values![metric])}
                />
              )}
            </g>
          );
        })}
        {ticks.map((p, i) => (
          <text
            key={i}
            x={x(p.time)}
            y={H - 8}
            textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
          >
            {new Date(p.time * 1000).toLocaleDateString(language, {
              timeZone: "UTC",
              day: "2-digit",
              month: "short",
            })}
          </text>
        ))}
        {hover && (
          <line
            x1={x(hover.time)}
            x2={x(hover.time)}
            y1={T}
            y2={H - B}
            stroke="#e6c080"
            strokeDasharray="3 3"
          />
        )}
      </svg>
      {hover && (
        <div className="chart-tooltip">
          {new Date(hover.time * 1000).toLocaleString(language, {
            timeZone: "UTC",
          })}{" "}
          UTC · {moneyText(hover.values?.[metric])}
        </div>
      )}
    </div>
  );
}
export function ItemDetail({
  id,
  names,
  market,
  history,
  favorite,
  onFavorite,
  onAdd,
  t,
  language,
}: {
  id: string;
  names: Catalogue;
  market: Market | null;
  history: PriceHistory | null;
  favorite: boolean;
  onFavorite: () => void;
  onAdd: () => void;
  t: Translate;
  language: Language;
}) {
  const [days, setDays] = useState(7);
  const [metric, setMetric] = useState(0);
  const [qty, setQty] = useState(20);
  const values = market?.items[id];
  const now = Math.floor(Date.now() / 1000);
  const points = useMemo(
    () => historyPoints(history, id, days, now),
    [history, id, days, now],
  );
  const observed = points.filter((p) => p.values);
  const prices = observed.map((p) => p.values![metric]);
  const first = observed[0]?.values?.[metric],
    last = observed.at(-1)?.values?.[metric];
  const change =
    first && last && observed.length > 1 ? (last / first - 1) * 100 : null;
  const quote = quoteDepth(market?.depth?.[id], qty);
  const hours = bestHours(history?.hourly, id, now);
  const week = historyPoints(history, id, 7, now).filter((p) => p.values);
  const average = week.length
    ? week.reduce((sum, p) => sum + p.values![0], 0) / week.length
    : 0;
  const pct = average && values ? (values[0] / average - 1) * 100 : null;
  return (
    <section className="panel detail-panel" id="detail">
      <div className="detail-top">
        <span className="eyebrow">{t("ITEM HISTORY", "ИСТОРИЯ ПРЕДМЕТА")}</span>
        <button
          className="icon-button"
          disabled={!values}
          onClick={onFavorite}
          aria-label={t("Favorite selected item", "В избранное")}
          aria-pressed={favorite}
        >
          {favorite ? "★" : "☆"}
        </button>
      </div>
      <div className="item-heading">
        <ItemIcon meta={names[id]} large />
        <div>
          <h2 id="detail-name" className={qualityClass(names[id]?.quality)}>
            {values
              ? names[id]?.name || `${t("Item", "Предмет")} #${id}`
              : t("Select an item", "Выберите предмет")}
          </h2>
          <span className="muted">
            {values
              ? `ID ${id}`
              : t(
                  "Choose a listing to view its history.",
                  "Выберите предмет в списке.",
                )}
          </span>
        </div>
      </div>
      <button className="button" disabled={!values} onClick={onAdd}>
        ＋ {t("Add to basket", "В корзину")}
      </button>
      <div className="detail-price">
        <span className="stat-label">
          {t("LOWEST UNIT PRICE", "МИНИМАЛЬНАЯ ЦЕНА ЗА ШТУКУ")}
        </span>
        <div>
          <Money value={values?.[0]} />
        </div>
        <span className="change">
          {change == null
            ? t(
                "Not enough observations to compare",
                "Недостаточно наблюдений для сравнения",
              )
            : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
        </span>
      </div>
      <div className="chart-controls">
        <div className="segmented">
          {[1, 7, 30, 90].map((value) => (
            <button
              key={value}
              className={days === value ? "active" : ""}
              onClick={() => setDays(value)}
            >
              {value === 1 ? t("24h", "24ч") : `${value}${t("d", "д")}`}
            </button>
          ))}
        </div>
        <select
          aria-label={t("Chart metric", "Метрика графика")}
          value={metric}
          onChange={(e) => setMetric(Number(e.target.value))}
        >
          <option value="0">{t("Minimum", "Минимум")}</option>
          <option value="1">{t("Median", "Медиана")}</option>
        </select>
      </div>
      <Chart
        points={points}
        metric={metric}
        days={days}
        language={language}
        t={t}
      />
      <div className="chart-caption">
        <span>
          {metric
            ? t("Median price", "Медианная цена")
            : t("Lowest buyout", "Минимальный выкуп")}
        </span>
        <span>
          {days <= 7
            ? t("Hourly · UTC", "Почасовые · UTC")
            : t("Daily · UTC", "Дневные · UTC")}
        </span>
      </div>
      <dl className="detail-stats">
        {[
          t("Median / unit", "МЕДИАНА / ШТ."),
          t("Available units", "ЕДИНИЦ В ПРОДАЖЕ"),
          t("Period low", "МИН. ЗА ПЕРИОД"),
          t("Period high", "МАКС. ЗА ПЕРИОД"),
        ].map((label, i) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {i === 1 ? (
                values?.[2].toLocaleString() || "—"
              ) : (
                <Money
                  value={
                    i === 0
                      ? values?.[1]
                      : prices.length
                        ? i === 2
                          ? Math.min(...prices)
                          : Math.max(...prices)
                        : null
                  }
                />
              )}
            </dd>
          </div>
        ))}
      </dl>
      <details className="trade-tools">
        <summary>
          {t(
            "Quantity estimate and market insights",
            "Оценка количества и анализ рынка",
          )}
        </summary>
        <label>
          {t("Quantity", "Количество")}{" "}
          <input
            type="number"
            min="1"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </label>
        <p>
          {quote?.complete ? (
            <>
              {t("Estimated cost", "Примерная стоимость")}:{" "}
              <Money value={quote.cost} /> · {quote.units} {t("units", "ед.")}
            </>
          ) : (
            t(
              "Insufficient stock or no listing depth available.",
              "Недостаточно лотов или нет данных глубины.",
            )
          )}
        </p>
        <p>
          {t(
            "Whole stacks, cheapest unit prices first; this estimate may buy extra.",
            "Целые пачки по цене за единицу; возможен избыток.",
          )}
        </p>
        <p>
          {pct != null && week.length >= 3
            ? `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}% ${t("against the 7-day average minimum.", "к среднему минимуму за 7 дней.")}`
            : t(
                "At least three snapshots are needed for comparison.",
                "Для сравнения нужны минимум три снимка.",
              )}
        </p>
        <p>
          {hours.length
            ? `${t("Highest observed hourly minimum", "Наибольший средний минимум по часу")}: ${hours[0].hour}:00 UTC`
            : t(
                "Hourly analysis needs observations from at least three days.",
                "Для анализа часа нужны наблюдения минимум за три дня.",
              )}
        </p>
      </details>
      <details className="history-details">
        <summary>{t("Price observations", "Таблица наблюдений")}</summary>
        <div className="history-scroll">
          <table>
            <thead>
              <tr>
                <th>UTC</th>
                <th>{t("Minimum", "Минимум")}</th>
                <th>{t("Median", "Медиана")}</th>
              </tr>
            </thead>
            <tbody>
              {[...observed].reverse().map((point) => (
                <tr key={point.time}>
                  <td>
                    {new Date(point.time * 1000).toLocaleString(language, {
                      timeZone: "UTC",
                    })}
                  </td>
                  <td>
                    <Money value={point.values![0]} />
                  </td>
                  <td>
                    <Money value={point.values![1]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="method-note">
        {t(
          "Active listing prices, not completed sales. Bid-only listings are excluded.",
          "Цены активных лотов, не совершённых сделок. Лоты без выкупа не учитываются.",
        )}
      </p>
    </section>
  );
}
