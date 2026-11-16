import type { Recipe } from "./types";
interface Result<T> {
  data: T[];
  source?: { build?: string };
  dataset?: string;
}
interface RecipeApi {
  Recipes: {
    search: (
      query: string,
      options: { locale: string; limit: number },
    ) => Promise<Result<Recipe>>;
  };
  Items: {
    getMany: (
      ids: number[],
      options: { locale: string },
    ) => Promise<Result<{ id: number; name?: string }>>;
  };
}
let loading: Promise<RecipeApi> | undefined;
export async function searchRecipes(query: string, locale: string) {
  const url = "https://warcraftforever.com/data/latest.mjs";
  loading ||= import(/* @vite-ignore */ url).catch((error) => {
    loading = undefined;
    throw error;
  });
  const api = await loading!;
  const response = await api.Recipes.search(query, { locale, limit: 30 });
  const recipes = response.data.filter(
    (r: Recipe) =>
      Number.isSafeInteger(r.product?.item) &&
      Number.isSafeInteger(r.product?.count) &&
      r.product.count > 0 &&
      Array.isArray(r.reagents) &&
      r.reagents.length > 0 &&
      r.reagents.every(
        (x) =>
          Array.isArray(x) &&
          Number.isSafeInteger(x[0]) &&
          x[0] > 0 &&
          Number.isSafeInteger(x[1]) &&
          x[1] > 0,
      ),
  );
  const ids = [
    ...new Set(
      recipes.flatMap((r: Recipe) => [
        r.product.item,
        ...r.reagents.map((x) => x[0]),
      ]),
    ),
  ];
  const names: Record<string, { name: string }> = {};
  for (let i = 0; i < ids.length; i += 50) {
    const items = await api.Items.getMany(ids.slice(i, i + 50), { locale });
    for (const item of items.data)
      if (item.name) names[String(item.id)] = { name: item.name };
  }
  return {
    recipes,
    names,
    build: response.source?.build || response.dataset || "",
  };
}
