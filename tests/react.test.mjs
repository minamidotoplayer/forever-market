import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://example.com/forever-market/",
});
Object.defineProperties(globalThis, {
  window: { value: dom.window, configurable: true },
  document: { value: dom.window.document, configurable: true },
  navigator: { value: dom.window.navigator, configurable: true },
  HTMLElement: { value: dom.window.HTMLElement, configurable: true },
  IS_REACT_ACT_ENVIRONMENT: { value: true, writable: true, configurable: true },
});
const { render, fireEvent, cleanup } = await import("@testing-library/react");
const { Listings } = await import("../src/components/Listings.tsx");
const market = {
  updatedAt: 1,
  items: { 1: [100, 100, 2, 1], 2: [200, 200, 3, 1] },
};
const names = {
  1: { name: "Greater Arcane Elixir", quality: 2, classId: 0, subclassId: 2 },
  2: { name: "Dreamfoil", quality: 1, classId: 7, subclassId: 9 },
};
test("React preserves listing rows when a different item is selected", () => {
  const props = {
    market,
    names,
    selected: "1",
    onSelect: () => {},
    favorites: new Set(),
    onFavorite: () => {},
    favoritesOnly: false,
    t: (en) => en,
    language: "en",
    onVisible: () => {},
  };
  const view = render(React.createElement(Listings, props));
  const row = view.getByText("Dreamfoil").closest("tr");
  view.rerender(React.createElement(Listings, { ...props, selected: "2" }));
  assert.equal(view.getByText("Dreamfoil").closest("tr"), row);
  assert.equal(row.getAttribute("aria-selected"), "true");
  cleanup();
});
test("English listing UI has partial search and category filters", () => {
  const view = render(
    React.createElement(Listings, {
      market,
      names,
      selected: "1",
      onSelect: () => {},
      favorites: new Set(),
      onFavorite: () => {},
      favoritesOnly: false,
      t: (en) => en,
      language: "en",
      onVisible: () => {},
    }),
  );
  fireEvent.change(view.getByLabelText("Search items"), {
    target: { value: "arc eli" },
  });
  assert.ok(view.getByText("Greater Arcane Elixir"));
  assert.equal(
    view.getByText("Greater Arcane Elixir").title,
    "Greater Arcane Elixir",
  );
  assert.equal(view.queryByText("Dreamfoil"), null);
  assert.equal(/[А-Яа-яЁё]/.test(view.container.textContent), false);
  cleanup();
});
const { waitFor } = await import("@testing-library/react");
Object.defineProperties(globalThis, {
  location: { value: dom.window.location, configurable: true },
  localStorage: { value: dom.window.localStorage, configurable: true },
});
const { App } = await import("../src/App.tsx");
test("English app has no Russian UI and reuses saved preferences", async () => {
  const original = globalThis.fetch;
  localStorage.clear();
  localStorage.setItem("fm-language", "en");
  localStorage.setItem("fm-favorites", '["1"]');
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () =>
      String(url).includes("index.json")
        ? {
            regions: [
              {
                id: "eu",
                rulesets: [
                  {
                    id: 1,
                    name: "PvP",
                    houses: [
                      {
                        id: 110,
                        name: "Alliance Auction House",
                        key: "eu-test",
                      },
                    ],
                  },
                ],
              },
            ],
          }
        : String(url).includes("items.json")
          ? names
          : String(url).includes("history/")
            ? { hourly: {}, daily: {} }
            : market,
  });
  try {
    const view = render(React.createElement(App));
    await waitFor(() =>
      assert.ok(
        view.getByRole("button", {
          name: "Greater Arcane Elixir",
          exact: true,
        }),
      ),
    );
    const selectedRow = view.container.querySelector(
      'tr[aria-selected="true"]',
    );
    const quickAdd = view.getByRole("button", {
      name: "Add to basket: Dreamfoil",
      exact: true,
    });
    fireEvent.click(quickAdd);
    fireEvent.click(quickAdd);
    assert.equal(JSON.parse(localStorage.getItem("fm-basket"))["2"], 2);
    assert.equal(
      view.container.querySelector('tr[aria-selected="true"]'),
      selectedRow,
    );
    assert.equal(quickAdd.querySelector(".basket-count").textContent, "2");
    const openBasket = view.getByRole("button", {
      name: "Open basket (2 units)",
      exact: true,
    });
    fireEvent.click(openBasket);
    assert.equal(view.container.querySelector(".basket-panel").open, true);
    assert.equal(/[А-Яа-яЁё]/.test(view.container.textContent), false);
    fireEvent.change(view.getByLabelText("Language"), {
      target: { value: "ru" },
    });
    assert.ok(view.getByText("Настройки данных"));
    fireEvent.change(view.getByLabelText("Language"), {
      target: { value: "en" },
    });
    assert.equal(/[А-Яа-яЁё]/.test(view.container.textContent), false);
    fireEvent.click(view.getByText("Data settings"));
    assert.equal(/[А-Яа-яЁё]/.test(view.container.textContent), false);
    fireEvent.click(view.getByLabelText("Close"));
    cleanup();
  } finally {
    cleanup();
    globalThis.fetch = original;
    localStorage.clear();
  }
});
const { useMarket } = await import("../src/hooks/useMarket.ts");
function Harness({ source }) {
  const data = useMarket(source, false);
  return React.createElement(
    "output",
    null,
    data.current.region?.id || "empty",
  );
}
test("a late index response cannot replace the current source", async () => {
  const original = globalThis.fetch;
  let finishOld;
  globalThis.fetch = async (url) => {
    const text = String(url);
    if (text.includes("old.example") && text.includes("index.json"))
      return new Promise((resolve) => {
        finishOld = () =>
          resolve({
            ok: true,
            json: async () => ({ regions: [{ id: "old", rulesets: [] }] }),
          });
      });
    return {
      ok: true,
      json: async () =>
        text.includes("index.json")
          ? { regions: [{ id: "new", rulesets: [] }] }
          : {},
    };
  };
  try {
    const view = render(
      React.createElement(Harness, { source: "https://old.example/data/" }),
    );
    view.rerender(
      React.createElement(Harness, { source: "https://new.example/data/" }),
    );
    await waitFor(() =>
      assert.equal(view.getByRole("status").textContent, "new"),
    );
    finishOld();
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(view.getByRole("status").textContent, "new");
    cleanup();
  } finally {
    cleanup();
    globalThis.fetch = original;
  }
});
function SnapshotHarness() {
  const data = useMarket("", false);
  return React.createElement(
    "div",
    null,
    React.createElement("output", null, data.market ? "loaded" : "empty"),
    React.createElement("button", { onClick: data.refresh }, "refresh"),
  );
}
test("failed index refresh clears the old market snapshot", async () => {
  const original = fetch;
  let offline = false;
  globalThis.fetch = async (url) => {
    if (offline) throw new Error("offline");
    return {
      ok: true,
      json: async () =>
        String(url).includes("index.json")
          ? {
              regions: [
                {
                  id: "eu",
                  rulesets: [
                    {
                      id: 1,
                      name: "PvP",
                      houses: [{ id: 110, name: "Alliance", key: "eu-test" }],
                    },
                  ],
                },
              ],
            }
          : String(url).includes("items.json")
            ? names
            : String(url).includes("history/")
              ? { hourly: {}, daily: {} }
              : market,
    };
  };
  try {
    const view = render(React.createElement(SnapshotHarness));
    await waitFor(() =>
      assert.equal(view.getByRole("status").textContent, "loaded"),
    );
    offline = true;
    fireEvent.click(view.getByText("refresh"));
    await waitFor(() =>
      assert.equal(view.getByRole("status").textContent, "empty"),
    );
  } finally {
    cleanup();
    globalThis.fetch = original;
  }
});
const { useMetadata } = await import("../src/hooks/useMetadata.ts");
function MetadataHarness({ seed, scope }) {
  const [catalogue, setCatalogue] = React.useState(seed);
  React.useEffect(() => setCatalogue(seed), [seed]);
  useMetadata(["42"], catalogue, setCatalogue, false, scope);
  return React.createElement("output", null, catalogue["42"].icon || "missing");
}
test("replaced catalogue reuses cached visible metadata", async () => {
  const original = fetch;
  localStorage.clear();
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      name: "Sword",
      icon: "inv_sword_01",
      quality: 2,
      tooltip: "<!--scstart2:7-->",
    }),
  });
  try {
    const view = render(
      React.createElement(MetadataHarness, {
        seed: { 42: { name: "Sword" } },
        scope: 1,
      }),
    );
    await waitFor(() =>
      assert.match(view.getByRole("status").textContent, /https:/),
    );
    view.rerender(
      React.createElement(MetadataHarness, {
        seed: { 42: { name: "Sword" } },
        scope: 2,
      }),
    );
    await waitFor(() =>
      assert.match(view.getByRole("status").textContent, /https:/),
    );
  } finally {
    cleanup();
    globalThis.fetch = original;
    localStorage.clear();
  }
});
const { BasketPanel } = await import("../src/components/BasketPanel.tsx");
test("Russian recipe response is discarded after switching to English", async () => {
  let finish;
  const search = () =>
    new Promise((resolve) => {
      finish = () =>
        resolve({
          recipes: [
            {
              id: 1,
              name: "Русский рецепт",
              product: { item: 1, count: 1 },
              reagents: [[2, 1]],
            },
          ],
          names: {},
          build: "test",
        });
    });
  const props = {
    search,
    basket: {},
    setBasket: () => {},
    selected: "1",
    market,
    names,
    onNames: () => {},
    language: "ru",
    t: (_en, ru) => ru,
  };
  try {
    const view = render(React.createElement(BasketPanel, props));
    view.container.querySelector("details").open = true;
    fireEvent.change(view.getByLabelText("Поиск рецептов"), {
      target: { value: "рецепт" },
    });
    fireEvent.click(view.getByText("Найти"));
    view.rerender(
      React.createElement(BasketPanel, {
        ...props,
        language: "en",
        t: (en) => en,
      }),
    );
    await React.act(async () => {
      finish();
      await Promise.resolve();
    });
    assert.equal(view.queryByText("Русский рецепт"), null);
    assert.equal(/[А-Яа-яЁё]/.test(view.container.textContent), false);
  } finally {
    cleanup();
  }
});
const { CategoryTree } = await import("../src/components/CategoryTree.tsx");
function CategoryHarness() {
  const [filters, setFilters] = React.useState({});
  return React.createElement(CategoryTree, {
    filters,
    language: "en",
    t: (en) => en,
    onChoose: (classId, subclassId) => setFilters({ classId, subclassId }),
  });
}
test("category parent selects and expands in one click; child and clear are explicit", () => {
  const view = render(React.createElement(CategoryHarness));
  fireEvent.click(view.getByRole("button", { name: "Armor", exact: true }));
  assert.equal(
    view
      .getByRole("button", { name: "Armor", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  assert.equal(
    view
      .getByRole("button", { name: "Armor", exact: true })
      .getAttribute("aria-expanded"),
    "true",
  );
  fireEvent.click(view.getByRole("button", { name: "Leather", exact: true }));
  assert.ok(
    view
      .getByLabelText("Selected category")
      .textContent.includes("Armor / Leather"),
  );
  fireEvent.click(view.getByRole("button", { name: "Armor", exact: true }));
  assert.ok(
    view
      .getByLabelText("Selected category")
      .textContent.includes("Armor / Leather"),
  );
  assert.equal(
    view
      .getByRole("button", { name: "Armor", exact: true })
      .getAttribute("aria-expanded"),
    "false",
  );
  fireEvent.click(view.getByRole("button", { name: "Armor", exact: true }));
  assert.equal(
    view
      .getByRole("button", { name: "Leather", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  fireEvent.click(view.getByRole("button", { name: "All Armor", exact: true }));
  assert.equal(
    view.getByLabelText("Selected category").textContent.includes("Leather"),
    false,
  );
  fireEvent.click(
    view.getByRole("button", { name: "Clear category", exact: true }),
  );
  assert.equal(
    view
      .getByRole("button", { name: "All items", exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  cleanup();
});

test("category choice filters listings and clearing restores the market", () => {
  const view = render(
    React.createElement(Listings, {
      market,
      names,
      selected: "1",
      onSelect: () => {},
      favorites: new Set(),
      onFavorite: () => {},
      favoritesOnly: false,
      t: (en) => en,
      language: "en",
      onVisible: () => {},
    }),
  );
  fireEvent.click(
    view.getByRole("button", { name: "Consumables", exact: true }),
  );
  assert.ok(view.getByText("Greater Arcane Elixir"));
  assert.equal(view.queryByText("Dreamfoil"), null);
  fireEvent.click(
    view.getByRole("button", { name: "Clear category", exact: true }),
  );
  assert.ok(view.getByText("Dreamfoil"));
  cleanup();
});

const { readFileSync } = await import("node:fs");
const { ItemDetail } = await import("../src/components/ItemDetail.tsx");
test("price statistics keep coin units inline instead of stacking label styles", () => {
  const stylesheet = document.createElement("style");
  stylesheet.textContent = readFileSync(
    new URL("../src/style.css", import.meta.url),
    "utf8",
  );
  document.head.append(stylesheet);
  const view = render(
    React.createElement(ItemDetail, {
      id: "1",
      names,
      market,
      history: null,
      favorite: false,
      onFavorite: () => {},
      onAdd: () => {},
      t: (en) => en,
      language: "en",
    }),
  );
  try {
    for (const span of view.container.querySelectorAll(
      ".detail-stats .money, .detail-stats .money span",
    )) {
      assert.notEqual(window.getComputedStyle(span).display, "block");
    }
  } finally {
    cleanup();
    stylesheet.remove();
  }
});

test("minimum-price change stays tied to minimum when chart switches to median", () => {
  const now = Math.floor(Date.now() / 1000);
  const view = render(
    React.createElement(ItemDetail, {
      id: "1",
      names,
      market,
      history: {
        hourly: {
          [now - 7200]: { 1: [100, 150] },
          [now - 3600]: { 1: [200, 600] },
        },
        daily: {},
      },
      favorite: false,
      onFavorite: () => {},
      onAdd: () => {},
      t: (en) => en,
      language: "en",
    }),
  );
  try {
    assert.equal(
      view.container.querySelector(".change").textContent,
      "+100.0%",
    );
    fireEvent.change(view.getByLabelText("Chart metric"), {
      target: { value: "1" },
    });
    assert.equal(
      view.container.querySelector(".change").textContent,
      "+100.0%",
    );
  } finally {
    cleanup();
  }
});

test("active filters stay visible when their controls are closed and can be removed", () => {
  const view = render(
    React.createElement(Listings, {
      market,
      names,
      selected: "1",
      onSelect: () => {},
      onAdd: () => {},
      favorites: new Set(),
      onFavorite: () => {},
      favoritesOnly: false,
      t: (en) => en,
      language: "en",
      onVisible: () => {},
    }),
  );
  try {
    const controls = view.container.querySelector(".auction-filters");
    controls.open = true;
    fireEvent.change(view.getByLabelText("Quality"), {
      target: { value: "2" },
    });
    controls.open = false;
    assert.ok(controls.querySelector("summary").textContent.includes("1"));
    fireEvent.click(
      view.getByRole("button", {
        name: "Remove filter: Quality: Uncommon",
        exact: true,
      }),
    );
    assert.ok(view.getByText("Dreamfoil"));
    assert.equal(
      view.queryByRole("button", {
        name: "Remove filter: Quality: Uncommon",
        exact: true,
      }),
      null,
    );
  } finally {
    cleanup();
  }
});

test("arriving metadata immediately updates search and category matches", () => {
  const props = {
    market,
    names: { 1: { name: "Item #1" }, 2: names[2] },
    selected: "1",
    onSelect: () => {},
    onAdd: () => {},
    favorites: new Set(),
    onFavorite: () => {},
    favoritesOnly: false,
    t: (en) => en,
    language: "en",
    onVisible: () => {},
  };
  const view = render(React.createElement(Listings, props));
  try {
    fireEvent.change(view.getByLabelText("Search items"), {
      target: { value: "arc eli" },
    });
    assert.equal(view.container.querySelectorAll("tbody tr").length, 0);
    view.rerender(React.createElement(Listings, { ...props, names }));
    assert.ok(view.getByText("Greater Arcane Elixir"));
    fireEvent.change(view.getByLabelText("Search items"), {
      target: { value: "" },
    });
    view.rerender(React.createElement(Listings, props));
    fireEvent.click(
      view.getByRole("button", { name: "Consumables", exact: true }),
    );
    assert.equal(view.container.querySelectorAll("tbody tr").length, 0);
    view.rerender(React.createElement(Listings, { ...props, names }));
    assert.ok(view.getByText("Greater Arcane Elixir"));
  } finally {
    cleanup();
  }
});

test("pagination exposes every snapshot item without dropping the final page", () => {
  const items = Object.fromEntries(
    Array.from({ length: 43 }, (_, i) => [String(i + 1), [i + 1, i + 1, 1, 1]]),
  );
  const view = render(
    React.createElement(Listings, {
      market: { updatedAt: 1, items },
      names: {},
      selected: "1",
      onSelect: () => {},
      onAdd: () => {},
      favorites: new Set(),
      onFavorite: () => {},
      favoritesOnly: false,
      t: (en) => en,
      language: "en",
      onVisible: () => {},
    }),
  );
  try {
    const seen = new Set();
    for (let page = 0; page < 3; page++) {
      for (const row of view.container.querySelectorAll("tbody tr"))
        seen.add(row.dataset.id);
      if (page < 2)
        fireEvent.click(view.getByRole("button", { name: "Next page" }));
    }
    assert.equal(seen.size, 43);
    assert.equal(
      view.getByRole("button", { name: "Next page" }).disabled,
      true,
    );
  } finally {
    cleanup();
  }
});
function RulesetHarness() {
  const data = useMarket("", false);
  return React.createElement(
    "div",
    null,
    React.createElement(
      "output",
      null,
      data.market?.items["1"]?.[0] ?? "loading",
    ),
    React.createElement(
      "button",
      { onClick: () => data.setSelection((old) => ({ ...old, ruleset: "2" })) },
      "switch ruleset",
    ),
  );
}
test("changing ruleset loads its own snapshot and replaces the previous price", async () => {
  const original = fetch;
  localStorage.clear();
  window.history.replaceState(null, "", "/forever-market/");
  localStorage.setItem(
    "fm-selection",
    JSON.stringify({ region: "eu", ruleset: "1", house: "113" }),
  );
  const paths = [];
  globalThis.fetch = async (url) => {
    const path = String(url);
    paths.push(path);
    return {
      ok: true,
      json: async () =>
        path.includes("index.json")
          ? {
              regions: [
                {
                  id: "eu",
                  rulesets: [1, 2].map((id) => ({
                    id,
                    name: String(id),
                    houses: [
                      {
                        id: id === 1 ? 110 : 111,
                        name: "Alliance",
                        key: `eu-${id}-alliance`,
                      },
                      {
                        id: id === 1 ? 113 : 114,
                        name: "Horde",
                        key: `eu-${id}-horde`,
                      },
                    ],
                  })),
                },
              ],
            }
          : path.includes("items.json")
            ? names
            : path.includes("history/")
              ? { hourly: {}, daily: {} }
              : {
                  updatedAt: 1,
                  items: {
                    1: [
                      path.includes("eu-2-horde")
                        ? 200
                        : path.includes("eu-2-alliance")
                          ? 999
                          : 100,
                      1,
                      1,
                      1,
                    ],
                  },
                },
    };
  };
  try {
    const view = render(React.createElement(RulesetHarness));
    await waitFor(() =>
      assert.equal(view.getByRole("status").textContent, "100"),
    );
    fireEvent.click(view.getByText("switch ruleset"));
    await waitFor(() =>
      assert.equal(view.getByRole("status").textContent, "200"),
    );
    assert.ok(paths.some((path) => path.includes("markets/eu-2-horde.json")));
  } finally {
    cleanup();
    globalThis.fetch = original;
    localStorage.clear();
  }
});
