export type Language = "en" | "ru";
export type Prices = [number, number, number, number];
export type DepthOffer = [number, number, number, boolean];
export interface ItemMeta {
  localizedNames?: Partial<Record<Language, string>>;
  name: string;
  icon?: string | null;
  quality?: number | null;
  classId?: number | null;
  subclassId?: number | null;
  requiredLevel?: number | null;
  missing?: boolean;
  metadataVersion?: number;
}
export type Catalogue = Record<string, ItemMeta>;
export interface Market {
  updatedAt: number;
  items: Record<string, Prices>;
  depth?: Record<string, DepthOffer[]>;
}
export interface PriceHistory {
  hourly: Record<string, Record<string, number[]>>;
  daily: Record<string, Record<string, number[]>>;
}
export interface House {
  id: number;
  name: string;
  key: string;
  updatedAt?: number;
  stale?: boolean;
}
export interface Ruleset {
  id: number;
  name: string;
  houses: House[];
}
export interface Region {
  id: string;
  rulesets: Ruleset[];
}
export interface MarketIndex {
  regions: Region[];
  generatedAt?: number;
  errors?: string[];
}
export interface Selection {
  region: string;
  ruleset: string;
  house: string;
}
export interface Filters {
  classId?: number | null;
  subclassId?: number | null;
  quality?: number | null;
  minLevel?: number | null;
  maxLevel?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
}
export interface Point {
  time: number;
  values: number[] | null;
}
export type Basket = Record<string, number>;
export type Translate = (en: string, ru: string) => string;
export interface Recipe {
  id: number;
  name?: string;
  product: { item: number; count: number };
  reagents: [number, number][];
}
