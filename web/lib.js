export function moneyParts(value) {
  if (!Number.isFinite(Number(value)) || value == null) return null;
  const copper = Math.round(Number(value));
  return { gold: Math.floor(copper / 10000), silver: Math.floor(copper % 10000 / 100), copper: copper % 100 };
}
export function itemMetadata(data) {
  if (!data || typeof data.name !== 'string' || !data.name.trim()) return null;
  const icon = typeof data.icon === 'string' && /^[a-z0-9_]+$/i.test(data.icon) ? `https://wow.zamimg.com/images/wow/icons/medium/${data.icon}.jpg` : null;
  const quality = Number.isInteger(data.quality) && data.quality >= 0 && data.quality <= 5 ? data.quality : null;
  const tooltip = typeof data.tooltip === 'string' ? data.tooltip : '';
  const classMatch = tooltip.match(/<!--scstart(\d+):(\d+)-->/);
  const levelMatch = tooltip.match(/<!--rlvl-->(\d+)/);
  return {name: data.name, icon, quality, classId: classMatch ? Number(classMatch[1]) : null, subclassId: classMatch ? Number(classMatch[2]) : null, requiredLevel: levelMatch ? Number(levelMatch[1]) : null, metadataVersion: 3};
}
export function qualityClass(quality) { return Number.isInteger(quality) && quality >= 0 && quality <= 5 ? `quality-${quality}` : ''; }
export function craftOutputChoices(selected, recipe) {
  return [...new Set([recipe, selected].filter(id => /^\d+$/.test(id || '')))];
}
export function groupAuctionHouses(houses) {
  const groups = new Map();
  for (const house of houses) {
    const name = house.name || 'Аукцион';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(house);
  }
  return [...groups].map(([name, members]) => ({name, houses: members}));
}
export function moneyText(value) {
  const p = moneyParts(value);
  return p ? `${p.gold}g ${p.silver}s ${p.copper}c` : '—';
}
export function historyPoints(history, id, days, now) {
  const source = days <= 7 ? history?.hourly : history?.daily;
  return Object.entries(source || {}).map(([time, items]) => ({ time: Number(time), values: items[id] || null }))
    .filter(p => p.time >= now - days * 86400).sort((a, b) => a.time - b.time);
}
const itemNameCollator = new Intl.Collator('ru', {numeric: true});
export function filterItems(items, names, query, favorites, favoritesOnly, sortKey, direction, filters = {}) {
  const search = query.trim().toLocaleLowerCase();
  const terms = search ? search.split(/\s+/) : [];
  return Object.entries(items || {}).filter(([id, values]) => {
    const meta = names[id] || {};
    if (filters.quality != null && meta.quality !== filters.quality) return false;
    if (filters.classId != null && meta.classId !== filters.classId) return false;
    if (filters.subclassId != null && meta.subclassId !== filters.subclassId) return false;
    if (filters.minLevel != null && (meta.requiredLevel == null || meta.requiredLevel < filters.minLevel)) return false;
    if (filters.maxLevel != null && (meta.requiredLevel == null || meta.requiredLevel > filters.maxLevel)) return false;
    if (filters.minPrice != null && values[0] < filters.minPrice) return false;
    if (filters.maxPrice != null && values[0] > filters.maxPrice) return false;
    return (!favoritesOnly || favorites.has(id)) && (!terms.length || terms.every(term => id.includes(term) || (meta.name || '').toLocaleLowerCase().includes(term)));
  })
    .sort(([a, av], [b, bv]) => {
      const result = sortKey === 'price' ? av[0] - bv[0] : sortKey === 'volume' ? av[2] - bv[2] : itemNameCollator.compare(names[a]?.name || a, names[b]?.name || b);
      return (result || Number(a) - Number(b)) * direction;
    });
}
export function csvValue(value) {
  return `"${String(value).replace(/^[=+\-@\t\r]/, "'$&").replaceAll('"', '""')}"`;
}
export function sourceUrl(value) {
  if (!value.trim()) return new URL('./data/', globalThis.location?.href || 'https://localhost/').href;
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Источник данных должен использовать HTTPS.');
  if (url.username || url.password || url.search || url.hash) throw new Error('Укажите адрес папки данных без пароля, параметров и #.');
  return url.href.replace(/\/?$/, '/');
}

// Greedy quote buys indivisible stacks in unit-price order. It is an estimate,
// not an optimal basket: buying whole stacks can overshoot the requested amount.
export function quoteDepth(offers, requested) {
  if (!Array.isArray(offers) || !Number.isSafeInteger(requested) || requested < 1) return null;
  let remaining = requested, cost = 0, units = 0;
  for (const [price, size, count, divisible] of offers) {
    if (!(price > 0 && Number.isSafeInteger(size) && size > 0 && Number.isSafeInteger(count) && count > 0)) continue;
    const take = Math.min(count, divisible ? remaining : Math.ceil(remaining / size));
    cost += take * price; units += take * size; remaining -= take * size;
    if (remaining <= 0) break;
  }
  return { cost, units, complete: remaining <= 0 };
}
export function bestHours(hourly, itemId, now) {
  const groups = Array.from({length:24}, () => []);
  for (const [time, items] of Object.entries(hourly || {})) {
    const t = Number(time), price = items[itemId]?.[0];
    if (t <= now && t >= now - 7 * 86400 && Number.isFinite(price) && price > 0) groups[new Date(t * 1000).getUTCHours()].push(price);
  }
  return groups.map((values, hour) => ({hour, count:values.length, average:values.reduce((a,b)=>a+b,0)/values.length})).filter(x=>x.count>=3).sort((a,b)=>b.average-a.average);
}
