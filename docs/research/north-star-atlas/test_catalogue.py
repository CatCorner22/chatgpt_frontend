"""Research-contract checks; no claim of customer or rendered verification."""
import copy
import json
import unittest

from build_catalogue import ROOT, build, validate
from journey_probe import inspect_journey


class CatalogueContracts(unittest.TestCase):
    def setUp(self):
        self.catalogue, self.sources = build()
        self.records = self.catalogue['decisions']
        self.by_id = {r['id']: r for r in self.records}
        self.contracts = json.loads((ROOT / 'journey-contracts.json').read_text())

    def test_checks_follow_the_selected_pattern(self):
        inline, modal = self.by_id['B15']['options']
        self.assertIn('without modal containment', inline['checks'][0])
        self.assertIn('remains inside', modal['checks'][0])
        self.assertNotEqual(inline['checks'], modal['checks'])

    def test_tableless_reflow_and_draft_do_not_require_unrelated_work(self):
        for option in self.by_id['R02']['options']:
            self.assertNotIn('B19', option['requires'])
            self.assertEqual(option['conditionalRequires'], [
                {'decision': 'B19', 'when': {'flag': 'hasTables', 'equals': True}}
            ])
        release, draft = self.by_id['V12']['options']
        self.assertNotIn('V09', release['requires'])
        self.assertEqual(release['conditionalRequires'][0]['when']['flag'], 'claimsNorthStarEquivalence')
        self.assertNotIn('V09', draft['requires'])
        self.assertNotIn('H15', draft['requires'])
        self.assertEqual(draft['conditionalRequires'], [])

    def test_ordinary_links_single_language_and_owner_only_access_remain_in_scope(self):
        self.assertEqual(self.by_id['B01']['applicability']['flag'], 'hasControls')
        for key in ['C10', 'H04']:
            self.assertIsNone(self.by_id[key]['applicability']['flag'])

    def test_combined_and_contextual_work_is_not_forced_into_single_selection(self):
        for key in ['R09', 'F21']:
            self.assertEqual(self.by_id[key]['selectionMode'], 'combine')
        self.assertEqual(self.by_id['B08']['selectionMode'], 'contextual')
        self.assertTrue(all(r['actionable'] is False for r in self.records))

    def test_malformed_unsafe_or_cyclic_records_are_rejected(self):
        mutations = [
            lambda r: r.append(copy.deepcopy(r[0])),
            lambda r: r[0].update(actionable=True),
            lambda r: r[0]['applicability'].update(onUnknown='passed'),
            lambda r: r[0]['applicability'].update(flag='unregisteredFlag'),
            lambda r: r[0].update(sources=['missing-source']),
            lambda r: r[0].update(requires=[r[0]['id']]),
            lambda r: (r[0].update(requires=[r[1]['id']]), r[1].update(requires=[r[0]['id']])),
            lambda r: r[0]['options'][0].update(checks=[]),
            lambda r: r[0]['options'][0].update(conditionalRequires=[
                {'decision': 'missing', 'when': {'flag': 'hasTables', 'equals': True}}
            ]),
        ]
        for mutate in mutations:
            with self.subTest(mutation=mutations.index(mutate)):
                records = copy.deepcopy(self.records)
                mutate(records)
                with self.assertRaises(ValueError):
                    validate(records, self.sources, self.contracts)

    def journey(self, roots, flags=None, options=None):
        context = {flag: False for flag in self.contracts['contextFlags']}
        context.update(flags or {})
        selections = {r['id']: [r['options'][0]['id']] for r in self.records}
        selections.update(options or {})
        return inspect_journey(self.records, self.contracts, roots, selections, context)

    def test_complete_draft_path_never_requires_release_authorization(self):
        for existing in [False, True]:
            result = self.journey(['V12'], {'hasExistingProject': existing, 'hasExport': True}, {'V12': ['V12.b']})
            self.assertNotIn('H15', result['required'])
            self.assertEqual(result['inapplicableRequired'], [])
            self.assertEqual(result['unresolved'], [])
        draft_authorization = self.journey(['H15'], options={'H15': ['H15.b']})
        self.assertEqual(draft_authorization['required'], ['H15'])

    def test_new_owner_typed_editorial_journey_has_no_existing_or_import_requirements(self):
        result = self.journey(['G01', 'C10', 'B01', 'H04', 'H10', 'V01'], {'hasControls': True, 'hasExport': True})
        self.assertFalse(set(result['required']) & {'G04', 'H01', 'H02', 'H03', 'H06'})
        self.assertEqual(result['inapplicableRequired'], [])
        self.assertEqual(result['unresolved'], [])

    def test_existing_form_trial_keeps_preservation_and_uses_inline_checks(self):
        result = self.journey(['H10', 'B15', 'R02'], {
            'hasExistingProject': True, 'hasExport': True, 'hasImportedContent': True,
            'hasInteractiveTask': True, 'hasForm': True, 'hasControls': True,
        }, {'B15': ['B15.a']})
        self.assertTrue({'H01', 'H02', 'H06'} <= set(result['required']))
        self.assertNotIn('B19', result['required'])
        self.assertEqual(result['inapplicableRequired'], [])
        self.assertEqual(result['unresolved'], [])

    def test_unknown_context_or_selection_never_looks_complete(self):
        result = inspect_journey(self.records, self.contracts, ['H10'], {'H10': ['H10.a']}, {'hasExport': True})
        self.assertEqual(result['status'], 'incomplete-planning-context')
        self.assertIn('context:hasExistingProject', result['unresolved'])
        self.assertIn('context:hasImportedContent', result['unresolved'])
        with self.assertRaises(ValueError):
            inspect_journey(self.records, self.contracts, ['G01'], {'G01': ['invented']}, {})


if __name__ == '__main__':
    unittest.main()
