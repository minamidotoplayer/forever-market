import importlib.util
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('collect', Path(__file__).resolve().parents[1] / 'scripts' / 'collect.py')
collector = importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)


class CollectorTest(unittest.TestCase):
    def test_ruleset_name_and_item_media(self):
        class API:
            def get(self, region, path, namespace='dynamic', optional=False, locale='en_US'):
                if path.endswith('/ruleset/index'): return {'rulesets': [{'id': 1}]}
                if path.endswith('/ruleset/1'): return {'name': 'PvP'}
                if path.endswith('/auctions/'): return {'auctions': [{'id': 110, 'name': 'Alliance'}]}
                if path.endswith('/commodities'): return {'auctions': []}
                if '/media/' in path: return {'assets': [{'key': 'icon', 'value': 'https://render.worldofwarcraft.com/icon.jpg'}]}
                if namespace == 'static': return {'name': 'Sword'}
                return {'auctions': [{'item': {'id': 42}, 'quantity': 1, 'buyout': 100}]}
        with tempfile.TemporaryDirectory() as directory, patch.object(collector, 'ROOT', Path(directory)):
            collector.collect(API(), ['eu'])
            self.assertEqual(collector.read_json(Path(directory) / 'index.json', {})['regions'][0]['rulesets'][0]['name'], 'PvP')
            self.assertEqual(collector.read_json(Path(directory) / 'items.json', {})['42']['icon'], 'https://render.worldofwarcraft.com/icon.jpg')
    def test_unit_price_and_quantity_weighted_median(self):
        offers = [
            {'item': {'id': 1}, 'quantity': 100, 'buyout': 10000},
            {'item': {'id': 1}, 'quantity': 1, 'buyout': 10000},
            {'item': {'id': 1}, 'quantity': 2, 'unit_price': 50},
            {'item': {'id': 1}, 'quantity': 1, 'bid': 1},
            {'item': {'id': 2}, 'quantity': 0, 'buyout': 20},
        ]
        self.assertEqual(collector.summarize(offers), {'1': [50, 100, 103, 3]})

    def test_depth_preserves_whole_stacks_and_divisible_commodities(self):
        rows = [{'item': {'id': 1}, 'quantity': 4, 'buyout': 100},
                {'item': {'id': 1}, 'quantity': 4, 'buyout': 100},
                {'item': {'id': 1}, 'quantity': 7, 'unit_price': 10}]
        self.assertEqual(collector.price_depth(rows), {'1': [[10, 1, 7, True], [100, 4, 2, False]]})

    def test_empty_house_is_a_valid_empty_snapshot(self):
        self.assertEqual(collector.summarize([]), {})

    def test_retention_same_hour_replacement_and_missing_items(self):
        now = 1800000000
        history = {'hourly': {'1': {'5': [1, 2, 3]}}, 'daily': {'1': {}}}
        collector.update_history(history, {'5': [10, 12, 7, 2]}, now)
        collector.update_history(history, {'6': [20, 22, 8, 1]}, now + 1)
        self.assertEqual(len(history['hourly']), 1)
        self.assertNotIn('5', next(iter(history['hourly'].values())))
        self.assertEqual(next(iter(history['hourly'].values())), {'6': [20, 22, 8]})
        self.assertEqual(len(history['daily']), 1)

    def test_regions_and_rulesets_never_share_different_data(self):
        class API:
            def get(self, region, path, namespace='dynamic', optional=False, locale='en_US'):
                if path.endswith('ruleset/index'):
                    return {'rulesets': [{'id': 1, 'name': 'PvP'}, {'id': 2, 'name': 'Normal'}]}
                if path.endswith('/auctions/'):
                    return {'auctions': [{'id': 110, 'name': 'Alliance'}]}
                if path.endswith('/commodities'):
                    return {'auctions': []}
                if namespace == 'static':
                    return {'name': 'Test item'}
                price = 100 if '/1/' in path else 200
                if region == 'us':
                    price *= 2
                return {'auctions': [{'item': {'id': 42}, 'quantity': 1, 'buyout': price}]}
        with tempfile.TemporaryDirectory() as directory, patch.object(collector, 'ROOT', Path(directory)):
            collector.collect(API(), ['eu', 'us'])
            index = collector.read_json(Path(directory) / 'index.json', {})
            prices = []
            for region in index['regions']:
                for rule in region['rulesets']:
                    key = rule['houses'][0]['key']
                    summary = collector.read_json(Path(directory) / 'markets' / f'{key}.json', {})
                    prices.append(summary['items']['42'][0])
            self.assertEqual(prices, [100, 200, 200, 400])

    def test_outage_does_not_replace_previous_data(self):
        class FailingAPI:
            def get(self, *args, **kwargs):
                raise RuntimeError('Service unavailable')
        with tempfile.TemporaryDirectory() as directory, patch.object(collector, 'ROOT', Path(directory)):
            path = Path(directory) / 'index.json'
            previous = {'regions': [{'id': 'eu', 'rulesets': []}], 'generatedAt': 100}
            collector.write_json(path, previous)
            with self.assertRaises(RuntimeError):
                collector.collect(FailingAPI(), ['eu'])
            self.assertEqual(collector.read_json(path, {}), previous)


if __name__ == '__main__':
    unittest.main()
