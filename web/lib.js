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
