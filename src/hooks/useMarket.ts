import { useEffect, useMemo, useState } from "react";
import type {
  Catalogue,
  Market,
  MarketIndex,
  PriceHistory,
  Selection,
} from "../types";
import { demoData, demoIndex } from "../demo";
import { sourceUrl } from "../lib";
import { savedSelection, writeStored } from "../storage";
async function fetchJson<T>(
  base: string,
  path: string,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(new URL(path, sourceUrl(base)), {
    signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    cache: "no-cache",
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
export function useMarket(source: string, demo: boolean) {
  const [selection, setSelection] = useState<Selection>(savedSelection);
  const [index, setIndex] = useState<MarketIndex>({ regions: [] });
  const [names, setNames] = useState<Catalogue>({});
  const [market, setMarket] = useState<Market | null>(null);
  const [history, setHistory] = useState<PriceHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, refresh] = useState(0);
  const [isDemo, setIsDemo] = useState(demo);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    setIndex({ regions: [] });
    setMarket(null);
    setHistory(null);
    (async () => {
      if (demo) {
        setIsDemo(true);
        setIndex(demoIndex);
        return;
      }
      const data = await fetchJson<MarketIndex>(
        source,
        "index.json",
        controller.signal,
      );
      if (!Array.isArray(data.regions)) throw new Error("Invalid market index");
      if (!active) return;
      if (!data.regions.length) {
        setIsDemo(true);
        setIndex(demoIndex);
        return;
      }
      setIsDemo(false);
      const catalogue = await fetchJson<Catalogue>(
        source,
        "items.json",
        controller.signal,
      ).catch(() => ({}));
      if (active) {
        setNames(catalogue);
        setIndex(data);
      }
    })().catch((e) => {
      if (active) {
        setError(String(e.message));
        setLoading(false);
      }
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [source, demo, revision]);
  const current = useMemo(() => {
    const region =
      index.regions.find((r) => r.id === selection.region) || index.regions[0];
    const rule =
      region?.rulesets.find((r) => String(r.id) === selection.ruleset) ||
      region?.rulesets[0];
    const previousHouse = index.regions
      .flatMap((region) => region.rulesets)
      .flatMap((rule) => rule.houses)
      .find((house) => String(house.id) === selection.house);
    const house =
      rule?.houses.find((h) => String(h.id) === selection.house) ||
      rule?.houses.find((h) => h.name === previousHouse?.name) ||
      rule?.houses[0];
    return { region, rule, house };
  }, [index, selection]);
  useEffect(() => {
    if (!current.region || !current.rule) return;
    const normalized = {
      region: current.region.id,
      ruleset: String(current.rule.id),
      house: String(current.house?.id || ""),
    };
    writeStored("fm-selection", normalized);
  }, [current]);
  useEffect(() => {
    if (!current.rule) {
      setMarket(null);
      setHistory(null);
      if (index.regions.length) {
        setError("No rulesets available");
        setLoading(false);
      }
      return;
    }
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError("");
    setMarket(null);
    setHistory(null);
    (async () => {
      if (isDemo) {
        const data = demoData(
          current.region!.id,
          String(current.rule!.id),
          String(current.house?.id || ""),
        );
        if (active) {
          setNames(data.names);
          setMarket(data.summary);
          setHistory(data.history);
        }
        return;
      }
      const house = current.house;
      if (!house) throw new Error("No auction house available");
      if (!/^[a-z0-9-]+$/.test(house.key))
        throw new Error("Invalid market key");
      const results = await Promise.allSettled([
        fetchJson<Market>(
          source,
          `markets/${house.key}.json`,
          controller.signal,
        ),
        fetchJson<PriceHistory>(
          source,
          `history/${house.key}.json`,
          controller.signal,
        ),
      ]);
      if (!active) return;
      if (results[0].status === "rejected") throw results[0].reason;
      const snapshot = results[0].value;
      if (!snapshot.items || !Number.isFinite(snapshot.updatedAt))
        throw new Error("Invalid snapshot");
      setMarket(snapshot);
      if (results[1].status === "fulfilled") setHistory(results[1].value);
      else setError("History is temporarily unavailable");
    })()
      .catch((e) => {
        if (active) setError(String(e.message));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [current, source, isDemo]);
  return {
    selection,
    setSelection,
    index,
    names,
    setNames,
    market,
    history,
    loading,
    error,
    isDemo,
    current,
    refresh: () => refresh((n) => n + 1),
  };
}
