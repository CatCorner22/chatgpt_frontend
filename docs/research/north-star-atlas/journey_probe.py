"""Research-only selected-path inspection, never an app or release gate."""


def inspect_journey(records, contracts, roots, selections, context):
    """Follow option-specific requirements; report unknown/inapplicable paths explicitly."""
    by_id = {r['id']: r for r in records}
    if set(context) - set(contracts['contextFlags']):
        raise ValueError('Unknown context flag')
    if any(type(v) is not bool for v in context.values()):
        raise ValueError('Known context values must be boolean')
    required, unresolved, inapplicable, skipped, conflicts = set(), set(), set(), set(), set()
    visited = set()

    def require_context(flag, expected, source):
        if flag not in context:
            unresolved.add('context:' + flag)
        elif context[flag] != expected:
            conflicts.add(f'{source} requires {flag}={str(expected).lower()}')

    # Do not silently infer that an operation exists, or treat missing context as false.
    for flag, implied_flags in contracts['contextImplications'].items():
        if context.get(flag) is True:
            for implied in implied_flags:
                require_context(implied, True, flag)

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
            constraint = contracts['optionConstraints'].get(option_id, {'context': [], 'selections': []})
            for condition in constraint['context']:
                require_context(condition['flag'], condition['equals'], option_id)
            for selection in constraint['selections']:
                visit(selection['decision'])
                other = selections.get(selection['decision'])
                if other and selection['option'] not in other:
                    conflicts.add(f"{option_id} requires {selection['option']}; selected {', '.join(other)}")
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
        'conflicts': sorted(conflicts),
        'status': ('conflicting-planning-choices' if conflicts else
                   'incomplete-planning-context' if unresolved or inapplicable else
                   'declared-constraints-satisfied'),
        'evidence': 'Only declared context, option and prerequisite constraints were evaluated. No complete semantic proof, implementation, behavior or release result was evaluated.',
    }
