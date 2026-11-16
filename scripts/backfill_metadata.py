"""Complete metadata for every item referenced by the current market index."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import time
import os
from collect import Blizzard, read_json, write_json, fetch_tooltip_metadata


def classification(api, item):
    try:
        data = api.get('eu', f'/data/wow/item/{item}', 'static', optional=True) or {}
        class_id = data.get('item_class', {}).get('id')
        subclass_id = data.get('item_subclass', {}).get('id')
        if class_id is not None and subclass_id is not None:
            return {'classId': class_id, 'subclassId': subclass_id, 'requiredLevel': data.get('required_level', 0)}
        return fetch_tooltip_metadata(item)
    except RuntimeError:
        return None


def backfill(root, workers=8, api=None):
    index = read_json(root / 'index.json', {})
    catalogue = read_json(root / 'items.json', {})
    ids = set()
    for region in index.get('regions', []):
        for rule in region.get('rulesets', []):
            for house in rule.get('houses', []):
                ids.update(read_json(root / 'markets' / f'{house["key"]}.json', {}).get('items', {}))
    now = int(time.time())
    pending = [item for item in sorted(ids, key=int)
               if not (catalogue.get(item, {}).get('metadataVersion') == 3
                       and all(catalogue[item].get(field) is not None for field in ('classId', 'subclassId', 'quality'))
                       and bool(catalogue[item].get('name', '').strip())
                       and str(catalogue[item].get('icon', '')).startswith('https://') and not catalogue[item].get('missing'))
               and now - catalogue.get(item, {}).get('tooltipCheckedAt', 0) > 7 * 86400]
    print(f'Current items: {len(ids)}; metadata to complete: {len(pending)}', flush=True)
    resolved = 0
    with ThreadPoolExecutor(max_workers=workers) as pool:
        for number, (item, meta) in enumerate(zip(pending, pool.map(fetch_tooltip_metadata, pending)), 1):
            old = catalogue.get(item, {})
            if meta:
                catalogue[item] = {**old, **{key: value for key, value in meta.items() if value is not None},
                                   'missing': False, 'tooltipCheckedAt': now, 'filterCheckedAt': now}
                resolved += 1
            # A transport failure must remain retryable; never replace cached metadata.
            if number % 100 == 0:
                write_json(root / 'items.json', catalogue)
                print(f'Metadata {number}/{len(pending)}; resolved {resolved}', flush=True)
    if api is not None:
        unclassified = [item for item in sorted(ids, key=int) if catalogue.get(item, {}).get('classId') is None or catalogue.get(item, {}).get('subclassId') is None]
        print(f'Blizzard categories to complete: {len(unclassified)}', flush=True)
        with ThreadPoolExecutor(max_workers=workers) as pool:
            for number, (item, meta) in enumerate(zip(unclassified, pool.map(lambda item: classification(api, item), unclassified)), 1):
                if meta:
                    catalogue[item] = {**catalogue.get(item, {}), **{key: value for key, value in meta.items() if value is not None}}
                if number % 100 == 0:
                    write_json(root / 'items.json', catalogue)
                    print(f'Categories {number}/{len(unclassified)}', flush=True)
    write_json(root / 'items.json', catalogue)
    print(f'Completed {resolved}/{len(pending)} items; failures will retry next run.', flush=True)
    print(f"Coverage: {sum(bool(catalogue.get(item, {}).get('name')) and not catalogue.get(item, {}).get('missing', False) for item in ids)}/{len(ids)} named; {sum(catalogue.get(item, {}).get('subclassId') is not None for item in ids)}/{len(ids)} classified", flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True)
    args = parser.parse_args()
    backfill(args.root, api=Blizzard() if os.environ.get("BNET_CLIENT_ID") and os.environ.get("BNET_CLIENT_SECRET") else None)
