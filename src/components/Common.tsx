import { moneyParts, qualityClass } from "../lib";
import type { ItemMeta } from "../types";
export function Money({ value }: { value?: number | null }) {
  const parts = moneyParts(value);
  if (!parts) return <>—</>;
  return (
    <span className="money">
      {parts.gold.toLocaleString()}
      <span className="g">g</span> {parts.silver}
      <span className="s">s</span> {parts.copper}
      <span className="c">c</span>
    </span>
  );
}
export function ItemIcon({
  meta,
  large = false,
}: {
  meta?: ItemMeta;
  large?: boolean;
}) {
  return (
    <span className={`item-art ${large ? "large" : ""}`} aria-hidden="true">
      {meta?.icon?.startsWith("https://") ? (
        <img
          src={meta.icon}
          alt=""
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
      ) : (
        "?"
      )}
    </span>
  );
}
export { qualityClass };
