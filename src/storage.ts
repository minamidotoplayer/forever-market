export function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (key === "fm-language" && (raw === "en" || raw === "ru"))
      return raw as T;
    return JSON.parse(raw || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Optional browser storage. */
  }
}
export function savedSelection() {
  const params = new URLSearchParams(location.search);
  const saved = readStored("fm-selection", {
    region: "eu",
    ruleset: "1",
    house: "110",
  });
  return {
    region: params.get("region") || saved.region,
    ruleset: params.get("ruleset") || saved.ruleset,
    house: params.get("house") || saved.house,
  };
}
