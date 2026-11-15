import test from 'node:test';
import assert from 'node:assert/strict';
import { moneyParts, historyPoints, filterItems, csvValue, sourceUrl } from '../web/lib.js';
test('prices preserve copper and carry at rounding boundaries', () => {
  assert.deepEqual(moneyParts(123456), { gold: 12, silver: 34, copper: 56 });
  assert.deepEqual(moneyParts(9999.8), { gold: 1, silver: 0, copper: 0 });
  assert.equal(moneyParts(null), null);
});
test('history keeps missing observations as gaps and excludes old dates', () => {
  const result = historyPoints({ hourly: { 1: { 42: [10, 20, 2] }, 100000: { 42: [20, 30, 3] }, 103600: {} } }, '42', 1, 104000);
  assert.deepEqual(result, [{ time: 100000, values: [20, 30, 3] }, { time: 103600, values: null }]);
});
test('search, favorites and numeric sorting work together', () => {
  const items = { 1: [400, 500, 5, 1], 2: [100, 120, 20, 3], 3: [5, 8, 4, 2] };
  const names = { 1: { name: 'Лотос' }, 2: { name: 'Чёрный лотос' }, 3: { name: 'Ткань' } };
  assert.deepEqual(filterItems(items, names, 'ЛОТОС', new Set(['2']), true, 'price', 1).map(x => x[0]), ['2']);
  assert.deepEqual(filterItems(items, names, '', new Set(), false, 'price', 1).map(x => x[0]), ['3', '2', '1']);
});
test('CSV escapes quotes and prevents spreadsheet formulas', () => {
  assert.equal(csvValue('=SUM(1)'), '"\'=SUM(1)"');
  assert.equal(csvValue('a"b'), '"a""b"');
});
test('external source requires HTTPS and cannot embed credentials', () => {
  assert.throws(() => sourceUrl('javascript:alert(1)'));
  assert.throws(() => sourceUrl('https://name:password@example.com/data'));
  assert.equal(sourceUrl('https://user.github.io/repo/data'), 'https://user.github.io/repo/data/');
});
test('depth quote respects indivisible stacks and reports shortages', async () => {
  const { quoteDepth } = await import('../web/lib.js');
  assert.deepEqual(quoteDepth([[20, 1, 3, true], [100, 5, 2, false]], 4), {cost:160, units:8, complete:true});
  assert.deepEqual(quoteDepth([[20, 1, 3, true]], 4), {cost:60, units:3, complete:false});
  assert.equal(quoteDepth(null, 3), null);
});
test('best hours require three observations in same UTC hour', async () => {
  const { bestHours } = await import('../web/lib.js');
  const now=1800000000, day=Math.floor(now/86400)*86400, history={};
  for(let n=0;n<3;n++) history[day-n*86400+3600]={42:[10+n,0,1]};
  assert.equal(bestHours(history,'42',now)[0].count,3);
  assert.deepEqual(bestHours(history,'99',now),[]);
});
