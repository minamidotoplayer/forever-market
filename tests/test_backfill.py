import sys
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import backfill_metadata as backfill
from collect import write_json, read_json


class BackfillTest(unittest.TestCase):
    def test_backfill_covers_current_snapshot_and_preserves_failed_records(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_json(root / 'index.json', {'regions': [{'rulesets': [{'houses': [{'key': 'test'}]}]}]})
            write_json(root / 'markets/test.json', {'items': {'1': [], '2': [], '3': []}})
            complete = {'name': 'Known', 'icon': 'https://icon', 'classId': 7, 'subclassId': 9, 'quality': 1, 'metadataVersion': 3}
            write_json(root / 'items.json', {'1': complete, '2': {'name': 'Cached', 'classId': 7, 'icon': 'https://icon', 'metadataVersion': 3}, '99': {'name': 'Unrelated'}})
            def resolve(item):
                return None if item == '2' else {'name': 'New', 'icon': 'https://icon', 'classId': 2, 'subclassId': 7, 'metadataVersion': 3}
            with patch.object(backfill, 'fetch_tooltip_metadata', side_effect=resolve) as fetch:
                backfill.backfill(root, workers=2)
                self.assertEqual({call.args[0] for call in fetch.call_args_list}, {'2', '3'})
            names = read_json(root / 'items.json', {})
            self.assertEqual(names['1'], complete)
            self.assertEqual(names['2'], {'name': 'Cached', 'classId': 7, 'icon': 'https://icon', 'metadataVersion': 3})
            self.assertEqual(names['3']['classId'], 2)
            self.assertFalse(names['3']['missing'])
