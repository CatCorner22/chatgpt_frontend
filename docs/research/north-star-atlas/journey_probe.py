"""Research-only selected-path inspection, never an app or release gate."""


def inspect_journey(records, contracts, roots, selections, context):
    """Follow option-specific requirements; report unknown/inapplicable paths explicitly."""
    by_id = {r['id']: r for r in records}
    if set(context) - set(contracts['contextFlags']):
        raise ValueError('Unknown context flag')
    if any(type(v) is not bool for v in context.values()):
        raise ValueError('Known context values must be boolean')
    required, unresolved, inapplicable, skipped = set(), set(), set(), set()
    visited = set()

    def visit(key):
        if key not in by_id:
            raise ValueError('Unknown decision')
        if key in visited:
            return
        visited.add(key)
        record = by_id[key]
        flag = record['applicability']['flag']
        if flag and flag not in context:
            unresolved.add('context:' + flag)
            return
        if flag and not context[flag]:
            inapplicable.add(key)
            return
        required.add(key)
        selected = selections.get(key)
        if not selected:
            unresolved.add('selection:' + key)
            return
        if not isinstance(selected, list) or len(selected) != len(set(selected)):
            raise ValueError('Invalid selection list')
        if record['selectionMode'] == 'single' and len(selected) != 1:
            raise ValueError('Single policy requires one selection')
        available = {o['id']: o for o in record['options']}
        for option_id in selected:
            if option_id not in available:
                raise ValueError('Unknown option for decision')
            option = available[option_id]
            for dependency in option['requires']:
                visit(dependency)
            for edge in option['conditionalRequires']:
                condition = edge['when']
                if condition['flag'] not in context:
                    unresolved.add('context:' + condition['flag'])
                elif context[condition['flag']] == condition['equals']:
                    visit(edge['decision'])
                else:
                    skipped.add((option_id, edge['decision'], condition['flag']))

    for root in roots:
        visit(root)
    return {
        'required': sorted(required),
        'unresolved': sorted(unresolved),
        'inapplicableRequired': sorted(inapplicable),
        'conditionalEdgesNotApplicable': sorted(skipped),
        'status': 'incomplete-planning-context' if unresolved or inapplicable else 'planning-path-consistent',
        'evidence': 'No implementation, behavior or release result was evaluated.',
    }
