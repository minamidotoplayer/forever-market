import { initLanguage, english } from './i18n.js';
import { moneyParts, moneyText, historyPoints, filterItems, csvValue, sourceUrl, quoteDepth, bestHours } from './lib.js';
import { demoData, demoIndex } from './demo.js';
const $ = id => document.getElementById(id);
const safeRead = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
const safeWrite = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Preferences are optional in private browsing. */ } };
const saved = safeRead('fm-selection', {});
const query = new URLSearchParams(location.search);
const state = {
  region: query.get('region') || saved.region || 'eu', ruleset: query.get('ruleset') || saved.ruleset || '1',
  house: query.get('house') || saved.house || '110', selected: query.get('item') || '13463',
  favorites: new Set(safeRead('fm-favorites', [])), favoritesOnly: false, query: '', sort: 'name', direction: 1, page: 1,
  days: 7, metric: 0, demo: false, source: safeRead('fm-source', ''), index: null, names: {}, summary: null, history: null,
  loading: false, request: 0, error: '', basket: safeRead('fm-basket', {}),
};
const PAGE_SIZE = 9;
const regionNames = { eu: 'Европа · EU', us: 'Америка · US', kr: 'Корея · KR', tw: 'Тайвань · TW' };
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const number = value => new Intl.NumberFormat('ru-RU').format(value);
const date = timestamp => new Date(timestamp * 1000).toLocaleString('ru-RU', { timeZone: 'UTC', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
function money(value) {
  const p = moneyParts(value);
  if (!p) return '—';
  return `<span class="money">${number(p.gold)}<span class="g">g</span> ${p.silver}<span class="s">s</span> ${p.copper}<span class="c">c</span></span>`;
}
function getRegion() { return state.index?.regions.find(region => region.id === state.region); }
function getRule() { return getRegion()?.rulesets.find(rule => String(rule.id) === state.ruleset); }
function getHouse() { return getRule()?.houses.find(house => String(house.id) === state.house); }
function nameOf(id) { const name = state.names[id]?.name || `Предмет #${id}`; return document.documentElement.lang === 'en' ? english(name) : name; }
function iconOf(id) { return state.names[id]?.icon || ['◆', '✧', '▰', '❧'][Number(id) % 4]; }
function selectionSaved() {
  safeWrite('fm-selection', { region: state.region, ruleset: state.ruleset, house: state.house });
  const params = new URLSearchParams({ region: state.region, ruleset: state.ruleset, house: state.house });
  if (state.selected) params.set('item', state.selected);
  try { history.replaceState(null, '', `${location.pathname}?${params}`); } catch { /* Local file preview. */ }
}
function options(id, values, selected) {
  $(id).replaceChildren(...values.map(([value, label]) => { const option = document.createElement('option'); option.value = String(value); option.textContent = label; return option; }));
  $(id).value = String(selected);
  $(id).disabled = !values.length;
}
function fillPickers() {
  const regions = state.index?.regions || [];
  if (!regions.some(region => region.id === state.region)) state.region = regions[0]?.id || 'eu';
  options('region', regions.map(region => [region.id, regionNames[region.id] || region.id]), state.region);
  const rules = getRegion()?.rulesets || [];
  if (!rules.some(rule => String(rule.id) === state.ruleset)) state.ruleset = String(rules[0]?.id || '');
  options('ruleset', rules.map(rule => [rule.id, `${rule.name} · #${rule.id}`]), state.ruleset);
  const houses = getRule()?.houses || [];
  if (!houses.some(house => String(house.id) === state.house)) state.house = String(houses[0]?.id || '');
  options('house', houses.map(house => [house.id, `${house.name} · #${house.id}`]), state.house);
  if (!houses.length) options('house', [['', 'Пока нет доступных аукционов']], '');
  $('house').disabled = !houses.length;
}
async function fetchData(path) {
  const response = await fetch(new URL(path, sourceUrl(state.source)), { cache: 'no-cache', signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Не удалось загрузить данные (HTTP ${response.status}).`);
  return response.json();
}
function loading(value) {
  state.loading = value;
  document.body.dataset.loading = String(value);
  $('refresh-button').disabled = value;
  $('export-button').disabled = value;
}
function renderNotice() {
  $('notice').classList.toggle('live', !state.demo && !state.error);
  if (state.error) $('notice').innerHTML = `<span>⚠ ${escape(state.error)}</span><button data-settings>Подключение ↗</button>`;
  else if (state.demo) $('notice').innerHTML = '<span>◈ <b>Демонстрационные данные.</b> Все цены и графики в этом режиме вымышлены.</span><button data-settings>Подключить Blizzard ↗</button>';
  else $('notice').innerHTML = `<span>◉ Данные Blizzard · ${state.index?.errors?.length ? 'Часть рынков недоступна. Проверяйте время снимка выбранного аукциона.' : 'Каждый аукцион хранится отдельно. Цены обновляются после запуска сборщика.'}</span>`;
  $('notice').querySelector('[data-settings]')?.addEventListener('click', showSettings);
}
async function loadIndex(forceReal = false) {
  const request = ++state.request;
  loading(true);
  state.error = '';
  try {
    const index = await fetchData('index.json');
    if (request !== state.request) return;
    if (!index || !Array.isArray(index.regions)) throw new Error('Источник вернул неверный формат индекса.');
    if (!index.regions.length) {
      if (forceReal || state.source) throw new Error('Снимков ещё нет. Запустите сборщик в GitHub Actions.');
      state.demo = true; state.index = demoIndex;
    } else {
      state.demo = false; state.index = index;
      try { state.names = await fetchData('items.json'); } catch { state.names = {}; }
      if (request !== state.request) return;
    }
    fillPickers();
    await loadMarket();
  } catch (error) {
    if (request !== state.request) return;
    state.error = error.name === 'TimeoutError' ? 'Источник не ответил за 30 секунд. Попробуйте обновить позже.' : error.message;
    state.summary = null; state.history = null;
    renderAll(); loading(false);
  }
}
async function loadMarket() {
  const request = ++state.request;
  loading(true); state.error = ''; state.summary = null; state.history = null; state.page = 1;
  renderAll();
  try {
    if (state.demo) {
      const demo = demoData(state.region, state.ruleset, state.house);
      Object.assign(state, { summary: demo.summary, history: demo.history, names: demo.names });
    } else {
      const house = getHouse();
      if (!house) throw new Error('Для этого рулсета API пока не вернул доступных аукционов.');
      if (!/^[a-z0-9-]+$/.test(house.key)) throw new Error('Некорректный идентификатор рынка.');
      const results = await Promise.allSettled([fetchData(`markets/${house.key}.json`), fetchData(`history/${house.key}.json`)]);
      if (request !== state.request) return;
      if (results[0].status !== 'fulfilled') throw results[0].reason;
      if (!results[0].value || !results[0].value.items || !Number.isFinite(results[0].value.updatedAt)) throw new Error('Некорректный снимок рынка.');
      state.summary = results[0].value;
      if (results[1].status === 'fulfilled') state.history = results[1].value;
      else state.error = 'Текущие цены загружены, но история временно недоступна.';
    }
    if (!state.summary.items[state.selected]) state.selected = Object.keys(state.summary.items)[0] || '';
    selectionSaved(); renderAll();
  } catch (error) {
    if (request !== state.request) return;
    state.error = error.message || 'Ошибка загрузки рынка.';
    state.summary = null; state.history = null; renderAll();
  } finally { if (request === state.request) { loading(false); renderFeed(); } }
}
function renderFeed() {
  const updated = state.summary?.updatedAt;
  const stale = updated && Date.now() / 1000 - updated > 3 * 3600;
  $('feed-dot').style.background = state.demo ? '#b39761' : stale || state.error ? '#c39158' : '#388658';
  $('feed-label').textContent = state.loading ? 'Загрузка рынка…' : !updated ? 'Нет снимка' : state.demo ? 'Демо · вымышленные цены' : `${stale ? 'Старый снимок · ' : 'Снимок · '}${date(updated)} UTC`;
}
function renderStats() {
  const entries = Object.values(state.summary?.items || {});
  $('item-count').textContent = state.summary ? number(entries.length) : '—';
  $('listing-count').textContent = state.summary ? number(entries.reduce((sum, v) => sum + v[3], 0)) : '—';
  $('unit-count').textContent = state.summary ? number(entries.reduce((sum, v) => sum + v[2], 0)) : '—';
  $('fav-count').textContent = state.favorites.size;
}
function filtered() { return filterItems(state.summary?.items, state.names, state.query, state.favorites, state.favoritesOnly, state.sort, state.direction); }
function renderTable() {
  const items = filtered();
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  state.page = Math.max(1, Math.min(state.page, totalPages));
  const start = (state.page - 1) * PAGE_SIZE;
  $('filtered-count').textContent = number(items.length);
  $('items-heading').firstChild.textContent = state.favoritesOnly ? 'Избранные предметы ' : 'Все предметы ';
  $('items-body').innerHTML = items.slice(start, start + PAGE_SIZE).map(([id, values]) => `<tr data-id="${escape(id)}" class="${state.selected === id ? 'selected' : ''}" aria-selected="${state.selected === id}"><td><div class="item-cell"><span class="item-art" data-tone="${Number(id) % 4}" aria-hidden="true">${escape(iconOf(id))}</span><div><button class="item-name quiet" data-select="${escape(id)}">${escape(nameOf(id))}</button><span class="item-id">ID ${escape(id)}</span></div></div></td><td>${money(values[0])}</td><td class="volume-col muted">${number(values[2])}</td><td><button class="favorite ${state.favorites.has(id) ? 'saved' : ''}" data-favorite="${escape(id)}" aria-label="${state.favorites.has(id) ? 'Убрать из избранного' : 'В избранное'}: ${escape(nameOf(id))}" aria-pressed="${state.favorites.has(id)}">${state.favorites.has(id) ? '★' : '☆'}</button></td></tr>`).join('');
  $('items-body').querySelectorAll('tr').forEach(row => row.addEventListener('click', event => { if (event.target.closest('[data-favorite]')) return; state.selected = row.dataset.id; selectionSaved(); renderTable(); renderDetail(); }));
  $('items-body').querySelectorAll('[data-favorite]').forEach(button => button.addEventListener('click', () => toggleFavorite(button.dataset.favorite)));
  $('empty-state').hidden = !!items.length;
  $('empty-state').textContent = state.loading ? 'Загружаем аукцион…' : !state.summary ? 'Нет данных рынка. Проверьте подключение или откройте демо.' : state.favoritesOnly ? 'Добавьте предметы в избранное с помощью ☆. Избранное сохраняется в этом браузере.' : state.query ? 'Ничего не найдено. Попробуйте название на английском или ID предмета.' : 'В этом снимке нет лотов с ценой выкупа.';
  $('pagination-label').textContent = items.length ? `${start + 1}–${Math.min(start + PAGE_SIZE, items.length)} из ${number(items.length)}` : '0 предметов';
  $('page-number').textContent = `${state.page} / ${totalPages}`;
  $('previous').disabled = state.page <= 1; $('next').disabled = state.page >= totalPages;
  $('export-button').disabled = !state.summary || !items.length;
  document.querySelectorAll('[data-sort]').forEach(button => {
    const active = button.dataset.sort === state.sort;
    button.querySelector('span').textContent = active ? state.direction === 1 ? '↑' : '↓' : '↕';
    button.closest('th').setAttribute('aria-sort', active ? state.direction === 1 ? 'ascending' : 'descending' : 'none');
  });
}
function toggleFavorite(id) {
  if (!id) return;
  state.favorites.has(id) ? state.favorites.delete(id) : state.favorites.add(id);
  safeWrite('fm-favorites', [...state.favorites]); renderStats(); renderTable(); renderDetail();
}
function renderBasket() {
  const entries = Object.entries(state.basket).filter(([id, qty]) => /^\d+$/.test(id) && Number.isInteger(qty) && qty > 0);
  let total = 0, missing = 0, unpriced = 0;
  const rows = entries.map(([id, qty]) => {
    const v = state.summary?.items[id];
    const q = quoteDepth(state.summary?.depth?.[id], qty); if (q?.complete) total += q.cost; else if (!v || q) missing++; else unpriced++;
    return `<div class="basket-row"><span>${escape(nameOf(id))} <small> #${escape(id)}</small></span><label>Qty / Кол-во <input type="number" min="1" max="1000000" value="${qty}" data-qty="${id}" aria-label="Quantity / Количество"></label><strong>${q?.complete ? money(q.cost) : '—'}</strong><button class="icon-button" data-remove="${id}" aria-label="Remove / Удалить">×</button></div>`;
  });
  $('basket-content').innerHTML = entries.length ? rows.join('') + `<p class="basket-total">Estimated total / Примерная сумма: <strong>${money(total)}</strong>${missing ? ` · ${missing} insufficient stock / недостаточно лотов` : ''}${unpriced ? ` · ${unpriced} no depth data / нет данных лотов` : ''}</p><p class="method-note">Estimate buys cheapest unit-price offers first, including whole stacks; it may buy extra and is not always the cheapest combination. / Оценка покупает лоты по цене за единицу, целые пачки могут дать избыток; это не всегда оптимальная комбинация.</p>` : '<p class="basket-empty">Select an item and add it here. / Выберите предмет и добавьте его в корзину.</p>';
  renderCraft(entries, total, missing + unpriced);
  $('basket-content').querySelectorAll('[data-qty]').forEach(input => input.addEventListener('change', () => { const value = Number(input.value); if (Number.isInteger(value) && value > 0 && value <= 1000000) state.basket[input.dataset.qty] = value; safeWrite('fm-basket', state.basket); renderBasket(); }));
  $('basket-content').querySelectorAll('[data-remove]').forEach(button => button.addEventListener('click', () => { delete state.basket[button.dataset.remove]; safeWrite('fm-basket', state.basket); renderBasket(); }));
}
function renderCraft(entries, ingredientCost, missing) {
  const select = $('craft-output');
  const previous = select.value || state.selected;
  const ids = Object.keys(state.summary?.items || {});
  options('craft-output', ids.map(id => [id, `${nameOf(id)} (#${id})`]), ids.includes(previous) ? previous : state.selected);
  const count = Number($('craft-count').value), fee = Number($('craft-fee').value), output = state.summary?.items[select.value];
  if (!entries.length || missing || !output || !Number.isInteger(count) || count < 1 || count > 10000 || !Number.isFinite(fee) || fee < 0 || fee > 100) {
    $('craft-result').textContent = 'Add available ingredients, choose an output, and enter valid quantities. Requires current listing data. / Добавьте доступные материалы, выберите результат и проверьте количество. Требуются данные лотов.'; return;
  }
  const buy = quoteDepth(state.summary?.depth?.[select.value], count);
  const sale = output[0] * count, net = sale * (1 - fee / 100), profit = net - ingredientCost;
  $('craft-result').innerHTML = `Craft cost / Крафт: ${money(ingredientCost)} · Buy output / Купить: ${buy?.complete ? money(buy.cost) : '—'} · Estimated net sale / После комиссии: ${money(net)} · Difference / Разница: ${profit < 0 ? '−' : '+'}${money(Math.abs(profit))}<p>Based on current lowest output listing, not a guaranteed sale. Deposits, vendor materials and crafting costs are excluded. / По минимальной цене результата; продажа не гарантирована. Залог, материалы у торговца и затраты на изготовление не учтены.</p>`;
}
function renderDetail() {
  const id = state.selected, values = state.summary?.items[id];
  $('detail-name').textContent = values ? nameOf(id) : 'Выберите предмет';
  $('detail-id').textContent = values ? `ID ${id} · ${getHouse()?.name || ''} · #${state.house}` : 'Его история появится здесь';
  $('detail-icon').textContent = iconOf(id || '0'); $('detail-icon').dataset.tone = String(Number(id || 0) % 4);
  $('detail-price').innerHTML = money(values?.[0]); $('median-price').innerHTML = money(values?.[1]);
  $('detail-volume').textContent = values ? number(values[2]) : '—';
  $('detail-favorite').disabled = !values;
  $('detail-favorite').textContent = state.favorites.has(id) ? '★' : '☆';
  $('detail-favorite').setAttribute('aria-pressed', String(state.favorites.has(id)));
  $('detail-favorite').setAttribute('aria-label', state.favorites.has(id) ? 'Убрать из избранного' : 'Добавить в избранное');
  const now = Math.floor(Date.now() / 1000);
  const points = values ? historyPoints(state.history, id, state.days, now) : [];
  const week = historyPoints(state.history, id, 7, now).filter(p => p.values && Number.isFinite(p.values[0]));
  const average = week.length ? week.reduce((sum, p) => sum + p.values[0], 0) / week.length : 0;
  const pct = average && values ? (values[0] / average - 1) * 100 : null;
  $('market-insight').textContent = pct === null || week.length < 3 ? 'Need at least 3 snapshots for a 7-day comparison. / Для сравнения нужно минимум 3 снимка.' : `Current minimum is ${Math.abs(pct).toFixed(0)}% ${pct < 0 ? 'below / ниже' : 'above / выше'} the average of ${week.length} hourly snapshots over 7 days. / средней цены по снимкам за 7 дней.`;
  $('basket-add').disabled = !values;
  const observed = points.filter(p => p.values && Number.isFinite(p.values[state.metric]));
  const prices = observed.map(p => p.values[state.metric]);
  $('period-low').innerHTML = prices.length ? money(Math.min(...prices)) : '—';
  $('period-high').innerHTML = prices.length ? money(Math.max(...prices)) : '—';
  const first = observed[0]?.values[state.metric], last = observed.at(-1)?.values[state.metric];
  const change = first > 0 && observed.length > 1 ? (last - first) / first * 100 : null;
  $('price-change').className = `change ${change > 0 ? 'up' : change < 0 ? 'down' : ''}`;
  $('price-change').textContent = change === null ? 'Недостаточно наблюдений для сравнения' : `${change >= 0 ? '↗ +' : '↘ '}${change.toFixed(1)}% за выбранный период${state.metric === 1 ? ' · медиана' : ''}`;
  $('legend-name').textContent = state.metric === 0 ? 'Минимальный выкуп' : 'Медианная цена';
  $('chart-resolution').textContent = `${state.demo ? 'Демо · ' : ''}${state.days <= 7 ? 'Почасовые' : 'Дневные'} снимки · UTC`;
  $('history-body').innerHTML = [...observed].reverse().map(point => `<tr><td>${escape(date(point.time))}</td><td>${money(point.values[0])}</td><td>${money(point.values[1])}</td></tr>`).join('') || '<tr><td colspan="3">Наблюдений пока нет</td></tr>';
  const qty = Number($('quote-qty').value), quote = quoteDepth(state.summary?.depth?.[id], qty);
  $('quote-result').innerHTML = !quote ? 'No listing depth available yet. / Данные лотов пока недоступны.' : !quote.complete ? `Only ${number(quote.units)} units available / доступно единиц: ${number(quote.units)}.` : `Estimated cost / Примерная стоимость: ${money(quote.cost)} · ${number(quote.units)} units / ед. (${money(quote.cost / quote.units)} / unit). Whole stacks, cheapest per unit first; not necessarily optimal. / Целые пачки, сначала по минимальной цене за штуку; не всегда оптимально.`;
  const hours = bestHours(state.history?.hourly, id, now);
  $('hour-result').innerHTML = hours.length ? `Highest observed listing minimum / Самый высокий средний минимум: ${String(hours[0].hour).padStart(2,'0')}:00 UTC · ${money(hours[0].average)} · ${hours[0].count} observations / наблюдений. Past listings are not completed sales. / Выставленные цены не гарантируют продажу.` : 'Best-hour analysis needs at least 3 days of hourly snapshots at the same UTC hour. / Для анализа часа нужны снимки минимум за 3 дня в один и тот же час UTC.';
  renderChart(points);
}
function renderChart(points) {
  const usable = points.filter(p => p.values && Number.isFinite(p.values[state.metric]));
  const chart = $('chart');
  if (!usable.length) { chart.innerHTML = '<div class="empty">История за этот период пока не накопилась.<br>Она появится после успешных запусков сборщика.</div>'; return; }
  const W = 440, H = 216, L = 51, R = 10, T = 16, B = 30;
  const values = usable.map(p => p.values[state.metric]);
  const low = Math.min(...values), high = Math.max(...values), pad = Math.max((high - low) * .25, high * .025, 1);
  const min = Math.max(0, low - pad), max = high + pad;
  const first = usable[0].time, last = usable.at(-1).time;
  const x = time => last === first ? (L + W - R) / 2 : L + (time - first) / (last - first) * (W - L - R);
  const y = price => T + (1 - (price - min) / (max - min)) * (H - T - B);
  let segments = [], segment = [];
  for (const point of points) {
    if (!point.values || !Number.isFinite(point.values[state.metric])) { if (segment.length) segments.push(segment); segment = []; continue; }
    if (segment.length && point.time - segment.at(-1).time > (state.days <= 7 ? 5400 : 129600)) { segments.push(segment); segment = []; }
    segment.push(point);
  }
  if (segment.length) segments.push(segment);
  const grid = Array.from({ length: 4 }, (_, i) => { const v = min + (max - min) * i / 3; const label = v >= 10000 ? `${(v / 10000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}g` : v >= 100 ? `${(v / 100).toFixed(0)}s` : `${v.toFixed(0)}c`; return `<line class="grid-line" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 10}" y="${y(v) + 3}" text-anchor="end">${label}</text>`; }).join('');
  const paths = segments.map(part => { const line = part.map((p, i) => `${i ? 'L' : 'M'}${x(p.time).toFixed(2)},${y(p.values[state.metric]).toFixed(2)}`).join(' '); return `<path d="${line} L${x(part.at(-1).time)},${H - B} L${x(part[0].time)},${H - B} Z" fill="url(#chart-fill)"/><path class="line" d="${line}"/>`; }).join('');
  const ticks = usable.length === 1 ? [usable[0]] : [usable[0], usable[Math.floor((usable.length - 1) / 2)], usable.at(-1)];
  const labels = ticks.map((p, i) => { const label = new Date(p.time * 1000).toLocaleString('ru-RU', { timeZone: 'UTC', ...(state.days === 1 ? { hour: '2-digit', minute: '2-digit' } : { day: '2-digit', month: 'short' }) }); return `<text x="${x(p.time)}" y="${H - 7}" text-anchor="${i === 0 && usable.length > 1 ? 'start' : i === 2 ? 'end' : 'middle'}">${escape(label)}</text>`; }).join('');
  chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escape(state.metric === 0 ? 'Минимальная цена' : 'Медианная цена')} ${escape(nameOf(state.selected))}, ${usable.length} наблюдений"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#c5d4b2" stop-opacity=".5"/><stop offset="100%" stop-color="#e4ebd9" stop-opacity=".05"/></linearGradient></defs>${grid}${paths}${usable.map(p => `<circle class="dot-point" cx="${x(p.time)}" cy="${y(p.values[state.metric])}" r="${usable.length < 3 ? 3 : 0}"/>`).join('')}${labels}<line id="crosshair" x1="0" x2="0" y1="${T}" y2="${H - B}" stroke="#acb99d" stroke-dasharray="3 3" visibility="hidden"/><circle id="hover-dot" r="4" fill="#69884f" stroke="#fffefa" stroke-width="2" visibility="hidden"/></svg><div class="chart-tooltip" hidden></div>`;
  const svg = chart.querySelector('svg'), tooltip = chart.querySelector('.chart-tooltip');
  svg.addEventListener('pointermove', event => {
    const rect = svg.getBoundingClientRect();
    const mouseX = (event.clientX - rect.left) / rect.width * W;
    const point = usable.reduce((best, p) => Math.abs(x(p.time) - mouseX) < Math.abs(x(best.time) - mouseX) ? p : best, usable[0]);
    const crosshair = chart.querySelector('#crosshair'), dot = chart.querySelector('#hover-dot');
    crosshair.setAttribute('x1', x(point.time)); crosshair.setAttribute('x2', x(point.time)); crosshair.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', x(point.time)); dot.setAttribute('cy', y(point.values[state.metric])); dot.setAttribute('visibility', 'visible');
    tooltip.textContent = `${date(point.time)} UTC · ${moneyText(point.values[state.metric])}`;
    tooltip.hidden = false;
    tooltip.style.left = `${Math.max(0, Math.min(event.clientX - rect.left - 80, rect.width - tooltip.offsetWidth))}px`;
  });
  svg.addEventListener('pointerleave', () => { tooltip.hidden = true; chart.querySelector('#crosshair').setAttribute('visibility', 'hidden'); chart.querySelector('#hover-dot').setAttribute('visibility', 'hidden'); });
}
function renderAll() { renderBasket(); renderNotice(); renderFeed(); renderStats(); renderTable(); renderDetail(); }
function showSettings() { $('data-source').value = state.source; $('settings-feedback').textContent = ''; if (!$('settings-dialog').open) $('settings-dialog').showModal(); }
function changeView(favorites) {
  state.favoritesOnly = favorites; state.page = 1;
  $('market-tab').classList.toggle('active', !favorites); $('favorites-tab').classList.toggle('active', favorites);
  $('breadcrumb').textContent = favorites ? 'ИЗБРАННОЕ' : 'ОБЗОР РЫНКА';
  $('page-title').innerHTML = favorites ? 'Ваши избранные<span>.</span>' : 'Рынок под контролем<span>.</span>';
  renderTable();
}
$('region').addEventListener('change', () => { state.region = $('region').value; fillPickers(); loadMarket(); });
$('ruleset').addEventListener('change', () => { state.ruleset = $('ruleset').value; fillPickers(); loadMarket(); });
$('house').addEventListener('change', () => { state.house = $('house').value; loadMarket(); });
$('search').addEventListener('input', () => { state.query = $('search').value; state.page = 1; renderTable(); });
$('previous').addEventListener('click', () => { state.page--; renderTable(); });
$('next').addEventListener('click', () => { state.page++; renderTable(); });
$('quote-qty').addEventListener('input', renderDetail);
for (const id of ['craft-output','craft-count','craft-fee']) $(id).addEventListener('change', renderBasket);
$('basket-add').addEventListener('click', () => { if (!state.selected || !state.summary?.items[state.selected]) return; state.basket[state.selected] = (state.basket[state.selected] || 0) + 1; safeWrite('fm-basket', state.basket); renderBasket(); });
$('detail-favorite').addEventListener('click', () => toggleFavorite(state.selected));
$('market-tab').addEventListener('click', () => changeView(false)); $('favorites-tab').addEventListener('click', () => changeView(true));
$('settings-button').addEventListener('click', showSettings); $('about-button').addEventListener('click', showSettings); $('method-button').addEventListener('click', showSettings);
$('close-dialog').addEventListener('click', () => $('settings-dialog').close());
$('settings-dialog').addEventListener('click', event => { if (event.target === $('settings-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
$('demo-button').addEventListener('click', () => { state.demo = true; state.index = demoIndex; fillPickers(); $('settings-dialog').close(); loadMarket(); });
$('save-source').addEventListener('click', () => {
  try { const raw = $('data-source').value.trim(); sourceUrl(raw); state.source = raw; safeWrite('fm-source', raw); state.demo = false; $('settings-dialog').close(); loadIndex(true); }
  catch (error) { $('settings-feedback').textContent = error.message; }
});
$('refresh-button').addEventListener('click', () => state.demo ? loadMarket() : loadIndex(true));
$('chart-metric').addEventListener('change', () => { state.metric = Number($('chart-metric').value); renderDetail(); });
for (const button of document.querySelectorAll('[data-days]')) button.addEventListener('click', () => { state.days = Number(button.dataset.days); document.querySelectorAll('[data-days]').forEach(b => b.classList.toggle('active', b === button)); renderDetail(); });
for (const button of document.querySelectorAll('[data-sort]')) button.addEventListener('click', () => { if (state.sort === button.dataset.sort) state.direction *= -1; else { state.sort = button.dataset.sort; state.direction = state.sort === 'volume' ? -1 : 1; } state.page = 1; renderTable(); });
$('export-button').addEventListener('click', () => {
  const rows = [['item_id', 'name', 'min_unit_copper', 'median_unit_copper', 'quantity', 'listings', 'region', 'ruleset', 'house', 'snapshot_utc', 'demo'], ...filtered().map(([id, v]) => [id, nameOf(id), ...v, state.region, state.ruleset, state.house, new Date(state.summary.updatedAt * 1000).toISOString(), state.demo])];
  const blob = new Blob(['\uFEFF' + rows.map(row => row.map(csvValue).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `forever-${state.demo ? 'demo-' : ''}${state.region}-${state.ruleset}-${state.house}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) && !$('settings-dialog').open) { event.preventDefault(); $('search').focus(); } });
initLanguage();
document.addEventListener('languagechange', () => { fillPickers(); renderAll(); });
loadIndex();
