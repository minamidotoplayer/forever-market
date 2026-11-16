import test from "node:test";
import assert from "node:assert/strict";
import {
  moneyParts,
  historyPoints,
  filterItems,
  csvValue,
  sourceUrl,
} from "../src/lib.ts";
test("auction filters intersect quality, category, required level and price", () => {
  const items = {
    1: [100, 100, 1, 1],
    2: [200, 200, 1, 1],
    3: [300, 300, 1, 1],
  };
  const names = {
    1: { quality: 2, classId: 4, requiredLevel: 10 },
    2: { quality: 3, classId: 4, requiredLevel: 20 },
  };
  const ids = (filters) =>
    filterItems(items, names, "", new Set(), false, "price", 1, filters).map(
      ([id]) => id,
    );
  assert.deepEqual(
    ids({ quality: 2, classId: 4, minLevel: 5, maxLevel: 15, maxPrice: 150 }),
    ["1"],
  );
  assert.deepEqual(ids({ minLevel: 1 }), ["1", "2"]);
  assert.deepEqual(ids({}), ["1", "2", "3"]);
});
test("subcategory IDs are scoped to their parent category", () => {
  const items = { 1: [1, 1, 1, 1], 2: [1, 1, 1, 1], 3: [1, 1, 1, 1] };
  const names = {
    1: { classId: 2, subclassId: 2 },
    2: { classId: 4, subclassId: 2 },
    3: { classId: 4 },
  };
  assert.deepEqual(
    filterItems(items, names, "", new Set(), false, "price", 1, {
      classId: 4,
      subclassId: 2,
    }).map(([id]) => id),
    ["2"],
  );
});
import {
  itemMetadata,
  craftOutputChoices,
  groupAuctionHouses,
  qualityClass,
} from "../src/lib.ts";
test("quality color uses known item rarity without inventing unknown values", () => {
  assert.equal(qualityClass(2), "quality-2");
  assert.equal(qualityClass(4), "quality-4");
  assert.equal(qualityClass(undefined), "");
  assert.equal(qualityClass(99), "");
});
test("auction groups combine matching names without losing distinct feeds", () => {
  const groups = groupAuctionHouses([
    { id: 110, name: "Alliance" },
    { id: 111, name: "Alliance" },
    { id: 113, name: "Horde" },
  ]);
  assert.deepEqual(
    groups.map((group) => [group.name, group.houses.map((house) => house.id)]),
    [
      ["Alliance", [110, 111]],
      ["Horde", [113]],
    ],
  );
  assert.deepEqual(groupAuctionHouses([]), []);
});
test("tooltip metadata safely supplies item names and icon URLs", () => {
  const gear = itemMetadata({
    name: "Gloves",
    tooltip: "<!--scstart4:2--><!--rlvl-->28",
  });
  assert.equal(gear.classId, 4);
  assert.equal(gear.subclassId, 2);
  assert.equal(gear.requiredLevel, 28);
  assert.deepEqual(
    itemMetadata({
      name: "Brawler Gloves",
      icon: "inv_gauntlets_05",
      quality: 3,
    }),
    {
      name: "Brawler Gloves",
      icon: "https://wow.zamimg.com/images/wow/icons/medium/inv_gauntlets_05.jpg",
      quality: 3,
      classId: null,
      subclassId: null,
      requiredLevel: null,
      metadataVersion: 3,
    },
  );
  assert.deepEqual(itemMetadata({ name: "Known", icon: "../bad" }), {
    name: "Known",
    icon: null,
    quality: null,
    classId: null,
    subclassId: null,
    requiredLevel: null,
    metadataVersion: 3,
  });
  assert.equal(itemMetadata({ name: "" }), null);
});
test("craft output choices stay bounded to selected and recipe items", () => {
  assert.deepEqual(craftOutputChoices("42", "43"), ["43", "42"]);
  assert.deepEqual(craftOutputChoices("42", "42"), ["42"]);
  assert.deepEqual(craftOutputChoices("", ""), []);
});
test("prices preserve copper and carry at rounding boundaries", () => {
  assert.deepEqual(moneyParts(123456), { gold: 12, silver: 34, copper: 56 });
  assert.deepEqual(moneyParts(9999.8), { gold: 1, silver: 0, copper: 0 });
  assert.equal(moneyParts(null), null);
});
test("history keeps missing observations as gaps and excludes old dates", () => {
  const result = historyPoints(
    {
      hourly: {
        1: { 42: [10, 20, 2] },
        100000: { 42: [20, 30, 3] },
        103600: {},
      },
    },
    "42",
    1,
    104000,
  );
  assert.deepEqual(result, [
    { time: 100000, values: [20, 30, 3] },
    { time: 103600, values: null },
  ]);
});
test("search, favorites and numeric sorting work together", () => {
  const items = { 1: [400, 500, 5, 1], 2: [100, 120, 20, 3], 3: [5, 8, 4, 2] };
  const names = {
    1: { name: "Лотос" },
    2: { name: "Чёрный лотос" },
    3: { name: "Ткань" },
  };
  assert.deepEqual(
    filterItems(items, names, "ЛОТОС", new Set(["2"]), true, "price", 1).map(
      (x) => x[0],
    ),
    ["2"],
  );
  assert.deepEqual(
    filterItems(items, names, "", new Set(), false, "price", 1).map(
      (x) => x[0],
    ),
    ["3", "2", "1"],
  );
});
test("search matches partial words in any order", () => {
  const items = { 1: [1, 1, 1, 1], 2: [2, 2, 2, 2] };
  const names = {
    1: { name: "Greater Arcane Elixir" },
    2: { name: "Dreamfoil" },
  };
  assert.deepEqual(
    filterItems(items, names, "eli arc", new Set(), false, "name", 1).map(
      (x) => x[0],
    ),
    ["1"],
  );
  assert.deepEqual(
    filterItems(items, names, "dr fo", new Set(), false, "name", 1).map(
      (x) => x[0],
    ),
    ["2"],
  );
});
test("CSV escapes quotes and prevents spreadsheet formulas", () => {
  assert.equal(csvValue("=SUM(1)"), '"\'=SUM(1)"');
  assert.equal(csvValue('a"b'), '"a""b"');
});
test("external source requires HTTPS and cannot embed credentials", () => {
  assert.throws(() => sourceUrl("javascript:alert(1)"));
  assert.throws(() => sourceUrl("https://name:password@example.com/data"));
  assert.equal(
    sourceUrl("https://user.github.io/repo/data"),
    "https://user.github.io/repo/data/",
  );
});
test("depth quote respects indivisible stacks and reports shortages", async () => {
  const { quoteDepth } = await import("../src/lib.ts");
  assert.deepEqual(
    quoteDepth(
      [
        [20, 1, 3, true],
        [100, 5, 2, false],
      ],
      4,
    ),
    { cost: 160, units: 8, complete: true },
  );
  assert.deepEqual(quoteDepth([[20, 1, 3, true]], 4), {
    cost: 60,
    units: 3,
    complete: false,
  });
  assert.equal(quoteDepth(null, 3), null);
});
test("best hours require three observations in same UTC hour", async () => {
  const { bestHours } = await import("../src/lib.ts");
  const now = 1800000000,
    day = Math.floor(now / 86400) * 86400,
    history = {};
  for (let n = 0; n < 3; n++)
    history[day - n * 86400 + 3600] = { 42: [10 + n, 0, 1] };
  assert.equal(bestHours(history, "42", now)[0].count, 3);
  assert.deepEqual(bestHours(history, "99", now), []);
});
