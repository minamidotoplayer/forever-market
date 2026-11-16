"""Read-only diagnostics of Blizzard ruleset routes; prints no credentials."""
import hashlib
import json
import urllib.parse
from collect import Blizzard

api = Blizzard()
region = 'eu'
for rule in api.get(region, '/data/wow/ruleset/index').get('rulesets', []):
    rule_id = rule['id']
    index_path = f'/data/wow/ruleset/{rule_id}/auctions/'
    index = api.get(region, index_path)
    print(json.dumps({'ruleset': rule_id, 'name': rule.get('name'),
                      'indexKeys': list(index), 'houses': [
                          {'id': house['id'], 'name': house.get('name'),
                           'path': urllib.parse.urlsplit(house.get('key', {}).get('href', '')).path}
                          for house in index.get('auctions', [])]}, ensure_ascii=False), flush=True)
    house = index['auctions'][0]
    advertised = urllib.parse.urlsplit(house.get('key', {}).get('href', '')).path
    direct = f'/data/wow/ruleset/{rule_id}/auctions/{house["id"]}'
    for path in dict.fromkeys([advertised or direct, direct]):
        data = api.get(region, path)
        rows = data.get('auctions', [])
        if isinstance(rows, dict):
            rows = api.get(region, rows['href']).get('auctions', [])
        fingerprint = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()[:16]
        print(json.dumps({'ruleset': rule_id, 'path': path, 'keys': list(data),
                          'rows': len(rows), 'fingerprint': fingerprint,
                          'items': len({row.get('item', {}).get('id') for row in rows}),
                          'rowKeys': list(rows[0]) if rows else []}), flush=True)

    if rule_id == 1:
        seen, conflicts, total = {}, 0, 0
        for member in index['auctions']:
            if member.get('name') != house.get('name'):
                continue
            member_path = urllib.parse.urlsplit(member['key']['href']).path
            payload = api.get(region, member_path)
            feeds = [('auctions', payload.get('auctions', []))]
            commodities = api.get(region, payload.get('commodities', {}).get('href', member_path + '/commodities'), optional=True) or {}
            feeds.append(('commodities', commodities.get('auctions', [])))
            for kind, feed in feeds:
                for row in feed:
                    total += 1
                    identity = (kind, row.get('id'))
                    content = (row.get('item', {}).get('id'), row.get('quantity'), row.get('buyout'), row.get('unit_price'))
                    if identity in seen and seen[identity] != content:
                        conflicts += 1
                    seen[identity] = content
        print(json.dumps({'factionRows': total, 'uniqueIds': len(seen), 'conflictingIds': conflicts}), flush=True)
