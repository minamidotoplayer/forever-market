// Entirely synthetic fixtures. Never written into the real collector's data directory.
export function demoData(region = 'eu', ruleset = '1', house = '110') {
  const now = Math.floor(Date.now() / 1000 / 3600) * 3600;
  const catalogue = [
    [13463, 'Снолист', 8750, '❧'], [13465, 'Горный серебряный шалфей', 12420, '❧'],
    [13468, 'Чёрный лотос', 1124000, '✾'], [12359, 'Ториевый слиток', 17600, '▰'],
    [14047, 'Руническая ткань', 1890, '▱'], [13446, 'Сильнейшее лечебное зелье', 38900, '♜'],
    [13444, 'Сильнейшее зелье маны', 42700, '♜'], [12363, 'Чародейный кристалл', 234000, '◆'],
    [16204, 'Пыль иллюзий', 34200, '✧'], [14344, 'Большой сверкающий осколок', 73800, '◇'],
    [13467, 'Ледяной зев', 14900, '❧'], [13466, 'Чумоцвет', 6700, '❧'],
    [7068, 'Первородный огонь', 182000, '♨'], [7078, 'Субстанция Огня', 198300, '♨'],
    [7076, 'Субстанция Земли', 104600, '◆'], [12808, 'Субстанция Нежити', 44200, '✧'],
    [13464, 'Золотой сансам', 3510, '❧'], [8838, 'Солнечник', 5600, '❧'],
    [8839, 'Пастушья сумка', 4100, '❧'], [3577, 'Золотой слиток', 11800, '▰'],
    [12360, 'Арканитовый слиток', 321000, '▰'], [16203, 'Великая вечная субстанция', 76900, '✦'],
    [15417, 'Шкура дьявозавра', 168000, '▱'], [15407, 'Обработанная грубая шкура', 145400, '▱'],
    [11176, 'Сонная пыль', 18400, '✧'], [2589, 'Льняной материал', 83, '▱'],
    [4306, 'Шёлковый материал', 671, '▱'], [4338, 'Магическая ткань', 1090, '▱'],
    [8150, 'Глубококаменная соль', 5300, '◇'], [7912, 'Массивный камень', 1810, '◆'],
    [12365, 'Массивный камень', 1250, '◆'], [3820, 'Удавник', 9300, '❧'],
  ];
  const factor = { eu: 1, us: .87, kr: 1.13, tw: .94 }[region] || 1;
  const adjustment = factor * (1 + (Number(house) % 7) * .027 + (Number(ruleset) % 4) * .018);
  const names = Object.fromEntries(catalogue.map(([id, name, , icon]) => [id, { name, icon }]));
  const history = { hourly: {}, daily: {} };
  function snapshot(time) {
    return Object.fromEntries(catalogue.map(([id, , base], i) => {
      const wave = Math.sin(time / 86400 * 1.1 + i * .8) * .11 + Math.sin(time / 86400 * .2 + i) * .06;
      const price = Math.round(base * adjustment * (1 + wave));
      return [id, [price, Math.round(price * (1.14 + (i % 4) * .05)), 250 + Math.round((1 + Math.sin(time / 16000 + i)) * (160 + i * 13))]];
    }));
  }
  for (let i = 167; i >= 0; i--) history.hourly[now - i * 3600] = snapshot(now - i * 3600);
  for (let i = 89; i >= 0; i--) { const day = Math.floor(now / 86400) * 86400 - i * 86400; history.daily[day] = snapshot(day); }
  const items = Object.fromEntries(Object.entries(snapshot(now)).map(([id, values], i) => [id, [...values, 8 + i * 5]]));
  const depth = Object.fromEntries(Object.entries(items).map(([id, values]) => [id, [[values[0], 1, Math.min(values[2], 20), true], [Math.round(values[0] * 1.2), 1, Math.max(1, values[2] - 20), true]]]));
  return { summary: { updatedAt: now, items, depth }, history, names };
}
export const demoIndex = {
  regions: ['eu', 'us', 'kr', 'tw'].map(id => ({ id, rulesets: [
    [1, 'PvP'], [2, 'Normal'], [3, 'Roleplay'], [15, 'Roleplay PvP'],
  ].filter(([rule]) => !['kr', 'tw'].includes(id) || rule <= 2).map(([rule, name]) => ({ id: rule, name, houses: [
    [110, 'Alliance Auction House'], [111, 'Horde Auction House'], [113, 'Blackwater Auction House'],
  ].map(([house, houseName]) => ({ id: house, name: houseName, key: `demo-${id}-${rule}-${house}` })) })) })),
};
