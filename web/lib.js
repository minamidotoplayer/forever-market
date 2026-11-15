export function moneyParts(value) {
  if (!Number.isFinite(Number(value)) || value == null) return null;
  const copper = Math.round(Number(value));
  return { gold: Math.floor(copper / 10000), silver: Math.floor(copper % 10000 / 100), copper: copper % 100 };
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
export function filterItems(items, names, query, favorites, favoritesOnly, sortKey, direction) {
  const search = query.trim().toLocaleLowerCase();
  return Object.entries(items || {}).filter(([id]) => (!favoritesOnly || favorites.has(id)) && (!search || id.includes(search) || (names[id]?.name || '').toLocaleLowerCase().includes(search)))
    .sort(([a, av], [b, bv]) => {
      const result = sortKey === 'price' ? av[0] - bv[0] : sortKey === 'volume' ? av[2] - bv[2] : (names[a]?.name || a).localeCompare(names[b]?.name || b, 'ru', { numeric: true });
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
