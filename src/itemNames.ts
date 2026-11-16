const phrases = {
  Снолист: "Dreamfoil",
  "Горный серебряный шалфей": "Mountain Silversage",
  "Чёрный лотос": "Black Lotus",
  "Ториевый слиток": "Thorium Bar",
  "Руническая ткань": "Runecloth",
  "Сильнейшее лечебное зелье": "Major Healing Potion",
  "Сильнейшее зелье маны": "Major Mana Potion",
  "Чародейный кристалл": "Arcane Crystal",
  "Пыль иллюзий": "Illusion Dust",
  "Большой сверкающий осколок": "Large Brilliant Shard",
  "Ледяной зев": "Icecap",
  Чумоцвет: "Plaguebloom",
  "Первородный огонь": "Heart of Fire",
  "Субстанция Огня": "Essence of Fire",
  "Субстанция Земли": "Essence of Earth",
  "Субстанция Нежити": "Essence of Undeath",
  "Золотой сансам": "Golden Sansam",
  Солнечник: "Sungrass",
  "Пастушья сумка": "Khadgar’s Whisker",
  "Золотой слиток": "Gold Bar",
  "Арканитовый слиток": "Arcanite Bar",
  "Великая вечная субстанция": "Greater Eternal Essence",
  "Шкура дьявозавра": "Devilsaur Leather",
  "Обработанная грубая шкура": "Cured Rugged Hide",
  "Сонная пыль": "Dream Dust",
  "Льняной материал": "Linen Cloth",
  "Шёлковый материал": "Silk Cloth",
  "Магическая ткань": "Mageweave Cloth",
  "Глубококаменная соль": "Deeprock Salt",
  "Массивный камень": "Dense Stone",
  Удавник: "Stranglekelp",
};
const ordered = Object.entries(phrases).sort(
  (a, b) => b[0].length - a[0].length,
);
export function english(s: string) {
  let result = s;
  for (const [ru, en] of ordered) result = result.replaceAll(ru, en);
  return result;
}
