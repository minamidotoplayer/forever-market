"""Blizzard Forever collector. Standard library only; never exports credentials."""
import base64
import collections
from concurrent.futures import ThreadPoolExecutor
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / 'web' / 'data'
REGIONS = ('eu', 'us', 'kr', 'tw')


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    temp.replace(path)


def read_json(path, default):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default


def request_json(url, headers=None, data=None, optional=False):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}, data=data), timeout=60) as res:
                return json.load(res)
        except urllib.error.HTTPError as error:
            if optional and error.code == 404:
                return None
            if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise RuntimeError(f'HTTP {error.code} from {urllib.parse.urlsplit(url).path}') from None
            retry = error.headers.get('Retry-After', '')
            time.sleep(min(int(retry) if retry.isdigit() else 2 ** attempt * 2, 45))
        except (urllib.error.URLError, TimeoutError):
            if attempt == 3:
                raise RuntimeError('Blizzard connection timed out') from None
            time.sleep(2 ** attempt)


class Blizzard:
    def __init__(self):
        client_id, secret = os.environ.get('BNET_CLIENT_ID'), os.environ.get('BNET_CLIENT_SECRET')
        if not client_id or not secret:
            raise RuntimeError('Set GitHub Secrets BNET_CLIENT_ID and BNET_CLIENT_SECRET first.')
        auth = base64.b64encode(f'{client_id}:{secret}'.encode()).decode()
        response = request_json('https://oauth.battle.net/token', {'Authorization': f'Basic {auth}', 'Content-Type': 'application/x-www-form-urlencoded'}, b'grant_type=client_credentials')
        self.token = response['access_token']

    def get(self, region, path, namespace='dynamic', optional=False, locale='en_US'):
        # Only fixed Blizzard hosts are used. API links contribute paths, never hostnames.
        path = urllib.parse.urlsplit(path).path
        query = urllib.parse.urlencode({'namespace': f'{namespace}-forever-{region}', 'locale': locale})
        return request_json(f'https://{region}.api.blizzard.com{path}?{query}', {'Authorization': f'Bearer {self.token}'}, optional=optional)


def summarize(auctions):
    groups = collections.defaultdict(list)
    for auction in auctions:
        item_id = auction.get('item', {}).get('id')
        quantity = auction.get('quantity', 0)
        unit = auction.get('unit_price')
        if unit is None and auction.get('buyout') is not None and quantity > 0:
            unit = auction['buyout'] / quantity
        if not item_id or quantity <= 0 or unit is None or unit <= 0:
            continue  # Bid-only listings have no observable buyout price.
        groups[str(item_id)].append((unit, quantity))
    result = {}
    for item_id, offers in groups.items():
        offers.sort()
        volume = sum(quantity for _, quantity in offers)
        cumulative = 0
        median = offers[-1][0]
        for price, quantity in offers:
            cumulative += quantity
            if cumulative >= volume / 2:
                median = price
                break
        result[item_id] = [round(offers[0][0], 2), round(median, 2), volume, len(offers)]
    return result


def price_depth(auctions):
    """Group identical offers. Commodity quantities are divisible; regular stacks are not."""
    groups = collections.defaultdict(collections.Counter)
    for row in auctions:
        item = row.get('item', {}).get('id')
        qty = row.get('quantity', 0)
        if not item or not isinstance(qty, int) or qty <= 0:
            continue
        if row.get('unit_price') is not None:
            unit = row['unit_price']
            if isinstance(unit, int) and unit > 0:
                groups[str(item)][(unit, 1, True)] += qty
        elif isinstance(row.get('buyout'), int) and row['buyout'] > 0:
            groups[str(item)][(row['buyout'], qty, False)] += 1
    return {item: [[price, qty, count, divisible] for (price, qty, divisible), count in sorted(offers.items(), key=lambda x: x[0][0] / x[0][1])] for item, offers in groups.items()}


def update_history(history, prices, timestamp):
    """Hourly latest observations for 7 days; last observation/day for 90 days."""
    hour = timestamp // 3600 * 3600
    day = timestamp // 86400 * 86400
    hourly = history.setdefault('hourly', {})
    daily = history.setdefault('daily', {})
    for bucket, key, cutoff in ((hourly, hour, timestamp - 7 * 86400), (daily, day, timestamp - 90 * 86400)):
        bucket[str(key)] = {item_id: values[:3] for item_id, values in prices.items()}
        for old in list(bucket):
            if int(old) < cutoff:
                del bucket[old]
    return history


def localized_name(value):
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get('en_US') or value.get('ru_RU') or next(iter(value.values()), '')
    return ''


def fallback_item_name(item_id):
    """Resolve missing names from Wowhead's Forever tooltip data."""
    try:
        data = request_json(f'https://nether.wowhead.com/forever/tooltip/item/{int(item_id)}', optional=True) or {}
        name = data.get('name')
        return name if isinstance(name, str) else ''
    except (RuntimeError, ValueError):
        return ''


def unique_auctions(feeds):
    result, seen = [], set()
    for feed in feeds:
        for row in feed:
            key = (row.get('id'), row.get('unit_price') is not None)
            if row.get('id') is not None:
                if key in seen:
                    continue
                seen.add(key)
            result.append(row)
    return result


def resolve_item_metadata(api, region, item_id, now):
    try:
        item = api.get(region, f'/data/wow/item/{int(item_id)}', 'static', optional=True)
        name = localized_name((item or {}).get('name'))
        source = 'blizzard'
        if not name:
            name = fallback_item_name(item_id)
            source = 'wowhead' if name else 'unknown'
        media = api.get(region, f'/data/wow/media/item/{int(item_id)}', 'static', optional=True) or {}
        icon = next((asset.get('value') for asset in media.get('assets', []) if asset.get('key') == 'icon' and isinstance(asset.get('value'), str) and asset['value'].startswith('https://')), None)
        item = item or {}
        quality = {'POOR': 0, 'COMMON': 1, 'UNCOMMON': 2, 'RARE': 3, 'EPIC': 4, 'LEGENDARY': 5}.get(item.get('quality', {}).get('type'))
        return {'name': name or f'Item #{item_id}', 'checkedAt': now, 'missing': not bool(name), 'icon': icon, 'mediaCheckedAt': now, 'fallbackCheckedAt': now, 'source': source, 'filterCheckedAt': now, 'quality': quality, 'classId': item.get('item_class', {}).get('id'), 'subclassId': item.get('item_subclass', {}).get('id'), 'requiredLevel': item.get('required_level')}
    except RuntimeError:
        return None


def collect(api, regions):
    now = int(time.time())
    old_index = read_json(ROOT / 'index.json', {'regions': []})
    old_regions = {region['id']: region for region in old_index.get('regions', [])}
    names = read_json(ROOT / 'items.json', {})
    output = {'version': 1, 'generatedAt': now, 'regions': [], 'errors': []}
    known_ids = set()
    successful = 0
    # Deduplicate canonical URLs within each ruleset while retaining raw IDs for the faction union.
    for region in regions:
        region_started = time.monotonic()
        try:
            rulesets = api.get(region, '/data/wow/ruleset/index').get('rulesets', [])
            entry = {'id': region, 'rulesets': []}
            for rule in rulesets:
                raw_feeds = {}
                group_feeds = collections.defaultdict(list)
                rule_id = int(rule['id'])
                rule_name = localized_name(rule.get('name'))
                if not rule_name:
                    detail = api.get(region, f'/data/wow/ruleset/{rule_id}', optional=True) or {}
                    rule_name = localized_name(detail.get('name'))
                rule_entry = {'id': rule_id, 'name': rule_name or str(rule_id), 'houses': []}
                houses = api.get(region, f'/data/wow/ruleset/{rule_id}/auctions/', optional=True)
                if houses is None:
                    rule_entry['unavailable'] = True
                    entry['rulesets'].append(rule_entry)
                    continue
                for house in houses.get('auctions', []):
                    house_id = int(house['id'])
                    path = urllib.parse.urlsplit(house.get('key', {}).get('href', f'/data/wow/ruleset/{rule_id}/auctions/{house_id}')).path
                    key = f'{region}-{hashlib.sha256(path.encode()).hexdigest()[:16]}'
                    try:
                        if path not in raw_feeds:
                            data = api.get(region, path, optional=True)
                            if data is None:
                                raise RuntimeError('Auction house is not available (404)')
                            auctions = data.get('auctions', [])
                            if isinstance(auctions, dict):
                                auctions = api.get(region, auctions['href']).get('auctions', [])
                            commodity_path = data.get('commodities', {}).get('href', path.rstrip('/') + '/commodities')
                            commodities = api.get(region, commodity_path, optional=True)
                            if commodities is None and data.get('commodities'):
                                raise RuntimeError('Advertised commodity feed is unavailable')
                            raw_feeds[path] = auctions + (commodities or {}).get('auctions', [])
                        rows = raw_feeds[path]
                        known_ids.update(str(row['item']['id']) for row in rows if row.get('item', {}).get('id'))
                        successful += 1
                        name = localized_name(house.get('name')) or str(house_id)
                        group_feeds[name].append(rows)
                        rule_entry['houses'].append({'id': house_id, 'name': name})
                    except (RuntimeError, KeyError, ValueError) as error:
                        output['errors'].append(f'{region}/{rule_id}/{house_id}: {error}')
                        raise RuntimeError('Incomplete faction snapshot; preserving previous region') from None
                grouped = []
                for name, feeds in group_feeds.items():
                    members = [house for house in rule_entry['houses'] if house['name'] == name]
                    key = f'{region}-faction-{hashlib.sha256(f"{rule_id}/{name}".encode()).hexdigest()[:16]}'
                    rows = unique_auctions(feeds)
                    prices = summarize(rows)
                    write_json(ROOT / 'markets' / f'{key}.json', {'updatedAt': now, 'items': prices, 'depth': price_depth(rows)})
                    history_path = ROOT / 'history' / f'{key}.json'
                    history = read_json(history_path, {'hourly': {}, 'daily': {}})
                    write_json(history_path, update_history(history, prices, now))
                    grouped.append({'id': members[0]['id'], 'name': name, 'key': key, 'updatedAt': now})
                rule_entry['houses'] = grouped
                entry['rulesets'].append(rule_entry)
            output['regions'].append(entry)
            print(f'Region {region}: {time.monotonic() - region_started:.1f}s', flush=True)
        except (RuntimeError, KeyError, ValueError) as error:
            output['errors'].append(f'{region}: {error}')
            if region in old_regions:
                previous = old_regions[region]
                previous['stale'] = True
                output['regions'].append(previous)
    if not successful or not output['regions']:
        raise RuntimeError('No auction feeds succeeded; keeping previous data. ' + '; '.join(output['errors']))
    # Bound name resolution per run. Missing lookups get an ID fallback and retry in 7 days.
    pending = [item_id for item_id in sorted(known_ids, key=int) if item_id not in names or 'subclassId' not in names[item_id] or 'mediaCheckedAt' not in names[item_id] or (names[item_id].get('missing') and ('fallbackCheckedAt' not in names[item_id] or now - names[item_id].get('checkedAt', 0) > 7 * 86400))]
    selected = pending[:int(os.environ.get('MAX_NAME_LOOKUPS', '300'))]
    started = time.monotonic()
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = pool.map(lambda item_id: resolve_item_metadata(api, regions[0], item_id, now), selected)
        for item_id, record in zip(selected, results):
            if record is not None:
                names[item_id] = record
    print(f'Metadata: {len(selected)} lookups in {time.monotonic() - started:.1f}s', flush=True)
    write_json(ROOT / 'items.json', names)
    write_json(ROOT / 'index.json', output)
    print(f'Updated {successful} market references in {len(output["regions"])} regions. {len(output["errors"])} feeds unavailable.')


if __name__ == '__main__':
    regions = [region.strip() for region in os.environ.get('REGIONS', ','.join(REGIONS)).split(',')]
    if not regions or any(region not in REGIONS for region in regions):
        raise SystemExit('REGIONS must contain eu,us,kr,tw. CN uses a separate platform and is not supported.')
    collect(Blizzard(), regions)
