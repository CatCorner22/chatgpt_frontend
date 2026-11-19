"""Build/check research data only. No application, network, storage or customer mutations."""
import argparse
import csv
import hashlib
import json
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
REGIONS = dict(zip("GCPDFBRHV", (
    "goal", "content", "plan", "direction", "craft", "behavior", "responsive", "handoff", "check"
)))
KINDS = {"contract", "observed-task", "artifact", "runtime", "rendered", "review"}
COLUMNS = ["id", "question", "option_a", "option_b", "requires", "check", "sources", "evidence_kind"]


def canonical_json(value):
    """Share the maintained formatter; checking and generation use identical bytes."""
    formatter = next((parent / 'scripts/format-research-json.mjs' for parent in ROOT.parents
                      if (parent / 'scripts/format-research-json.mjs').is_file()), None)
    if formatter is None:
        raise ValueError('Run from the complete Focus checkout with its installed dependencies')
    return subprocess.run(
        ['node', str(formatter), str(ROOT / 'decisions.json')],
        input=json.dumps(value, ensure_ascii=False), text=True, capture_output=True, check=True,
    ).stdout.encode('utf-8')


def validate(catalogue, sources, contracts):
    if not isinstance(catalogue, list) or not catalogue or len(catalogue) > 1000:
        raise ValueError("Catalogue must contain 1 to 1000 records")
    if not isinstance(sources, dict) or not sources:
        raise ValueError("Sources must be a nonempty object")
    expected = {"id", "region", "question", "options", "requires", "check", "sources", "evidenceKind", "status", "selectionMode", "responsibleActor", "applicability", "navigation", "actionable"}
    ids = set()
    for record in catalogue:
        if not isinstance(record, dict) or set(record) != expected:
            raise ValueError("Unknown or missing record field")
        key = record["id"]
        if not isinstance(key, str) or len(key) != 3 or key[0] not in REGIONS or not key[1:].isascii() or not key[1:].isdigit():
            raise ValueError("Invalid decision ID")
        if key in ids:
            raise ValueError("Duplicate decision ID: " + key)
        ids.add(key)
        if record["region"] != REGIONS[key[0]] or record["status"] != "proposal":
            raise ValueError("Region or proposal status mismatch: " + key)
        if record["actionable"] is not False:
            raise ValueError("Research records cannot enable product controls")
        if record["selectionMode"] not in ["single", "combine", "contextual"]:
            raise ValueError("Invalid selection mode")
        if record["responsibleActor"] not in ["owner", "owner-and-developer", "developer", "reviewer"]:
            raise ValueError("Unknown responsible actor")
        applicability = record["applicability"]
        if not isinstance(applicability, dict) or set(applicability) != {"flag", "onUnknown", "onFalse"}:
            raise ValueError("Invalid applicability")
        if applicability["flag"] is not None and applicability["flag"] not in contracts["contextFlags"]:
            raise ValueError("Unknown applicability flag")
        if applicability["onUnknown"] != "request-context" or applicability["onFalse"] != "not-applicable-with-reason-not-pass":
            raise ValueError("Unknown and not-applicable cannot become passed")
        navigation = record["navigation"]
        if not isinstance(navigation, dict) or set(navigation) != {"kind", "entry", "nextAction"}:
            raise ValueError("Invalid navigation contract")
        if navigation["kind"] not in ["existing-general-entry", "handoff-planning-only"] or not isinstance(navigation["nextAction"], str):
            raise ValueError("Unknown navigation kind")
        for field in ["question", "check"]:
            if not isinstance(record[field], str) or not record[field].strip() or len(record[field]) > 2000:
                raise ValueError("Missing or oversized text: " + key)
        if not isinstance(record["evidenceKind"], str) or record["evidenceKind"] not in KINDS:
            raise ValueError("Unknown evidence kind: " + key)
        options = record["options"]
        if not isinstance(options, list) or len(options) != 2:
            raise ValueError("This catalogue version requires two candidate alternatives")
        for option, suffix in zip(options, ("a", "b")):
            if not isinstance(option, dict) or set(option) != {"id", "consequence", "checks", "requires", "conditionalRequires"}:
                raise ValueError("Unknown option field")
            if option["id"] != key + "." + suffix or not isinstance(option["consequence"], str) or not option["consequence"].strip() or len(option["consequence"]) > 2000:
                raise ValueError("Invalid option: " + key)
            if not isinstance(option["checks"], list) or not option["checks"] or any(not isinstance(c, str) or not c.strip() for c in option["checks"]):
                raise ValueError("Missing option check")
            if not isinstance(option["requires"], list) or any(not isinstance(d, str) for d in option["requires"]):
                raise ValueError("Invalid option prerequisites")
            if not isinstance(option["conditionalRequires"], list):
                raise ValueError("Invalid conditional prerequisites")
            for condition in option["conditionalRequires"]:
                if not isinstance(condition, dict) or set(condition) != {"decision", "when"}:
                    raise ValueError("Invalid conditional prerequisite")
                when = condition["when"]
                if not isinstance(when, dict) or set(when) != {"flag", "equals"} or when["flag"] not in contracts["contextFlags"] or type(when["equals"]) is not bool:
                    raise ValueError("Unknown or malformed context condition")
        if options[0]["consequence"] == options[1]["consequence"]:
            raise ValueError("Duplicate alternatives: " + key)
        for field in ["requires", "sources"]:
            values = record[field]
            if not isinstance(values, list) or any(not isinstance(v, str) or not v for v in values):
                raise ValueError("Invalid references: " + key)
            if len(values) != len(set(values)):
                raise ValueError("Duplicate references: " + key)
        if not record["sources"] or any(s not in sources for s in record["sources"]):
            raise ValueError("Unknown or absent source: " + key)
    option_owners = {o['id']: r['id'] for r in catalogue for o in r['options']}
    constraints = contracts.get('optionConstraints')
    implications = contracts.get('contextImplications')
    if not isinstance(constraints, dict) or not isinstance(implications, dict):
        raise ValueError('Missing declared planning constraints')
    for flag, implied in implications.items():
        if flag not in contracts['contextFlags'] or not isinstance(implied, list) or not implied:
            raise ValueError('Invalid context implication')
        if any(not isinstance(item, str) or item not in contracts['contextFlags'] or item == flag for item in implied):
            raise ValueError('Unknown or self context implication')
    constraint_edges = {key: [] for key in ids}
    for option_id, constraint in constraints.items():
        if option_id not in option_owners or not isinstance(constraint, dict) or set(constraint) != {'context', 'selections'}:
            raise ValueError('Unknown or malformed option constraint')
        if not isinstance(constraint['context'], list) or not isinstance(constraint['selections'], list):
            raise ValueError('Invalid constraint lists')
        for condition in constraint['context']:
            if not isinstance(condition, dict) or set(condition) != {'flag', 'equals'} or condition['flag'] not in contracts['contextFlags'] or type(condition['equals']) is not bool:
                raise ValueError('Invalid option context condition')
        for selection in constraint['selections']:
            if not isinstance(selection, dict) or set(selection) != {'decision', 'option'}:
                raise ValueError('Invalid selection constraint')
            if selection['decision'] not in ids or option_owners.get(selection['option']) != selection['decision']:
                raise ValueError('Unknown or mismatched constraint option')
            constraint_edges[option_owners[option_id]].append(selection['decision'])
    graph = {r["id"]: list(dict.fromkeys(r["requires"] + [d for o in r["options"] for d in o["requires"]] + [c["decision"] for o in r["options"] for c in o["conditionalRequires"]] + constraint_edges[r['id']])) for r in catalogue}
    for key, dependencies in graph.items():
        if any(d not in ids or d == key for d in dependencies):
            raise ValueError("Unknown or self prerequisite: " + key)
    active, visited = set(), set()

    def visit(key):
        if key in active:
            raise ValueError("Prerequisite cycle: " + key)
        if key in visited:
            return
        active.add(key)
        for dependency in graph[key]:
            visit(dependency)
        active.remove(key)
        visited.add(key)

    for key in graph:
        visit(key)
    if {r["region"] for r in catalogue} != set(REGIONS.values()):
        raise ValueError("A Garden region has no decisions")


def build():
    sources = json.loads((ROOT / "sources.json").read_text())
    contracts = json.loads((ROOT / "journey-contracts.json").read_text())
    with (ROOT / "decisions.tsv").open(newline="") as stream:
        reader = csv.DictReader(stream, delimiter="\t")
        if reader.fieldnames != COLUMNS:
            raise ValueError("Unexpected TSV columns")
        rows = list(reader)
    records = []
    applicability = {}
    for flag, decision_ids in contracts["applicabilityByFlag"].items():
        if flag not in contracts["contextFlags"]:
            raise ValueError("Undefined context flag")
        for key in decision_ids:
            if key in applicability:
                raise ValueError("Conflicting applicability flags")
            applicability[key] = flag
    modes = {}
    for mode, decision_ids in contracts["selectionModes"].items():
        for key in decision_ids:
            if key in modes:
                raise ValueError("Conflicting selection modes")
            modes[key] = mode
    for row in rows:
        if set(row) != set(COLUMNS) or any(v is None for v in row.values()):
            raise ValueError("Malformed TSV row")
        key = row["id"]
        prerequisites = row["requires"].split(",") if row["requires"] else []
        options = []
        for suffix in ["a", "b"]:
            option_id = key + "." + suffix
            override = contracts["optionOverrides"].get(option_id, {})
            options.append({
                "id": option_id, "consequence": row["option_" + suffix],
                "checks": override.get("checks", [row["check"]]),
                "requires": override.get("requires", prerequisites),
                "conditionalRequires": override.get("conditionalRequires", []),
            })
        # Option prerequisites are authoritative. The record list is their default,
        # not a second set to union back after an explicit option override.
        for option in options:
            unconditional = []
            conditional = list(option["conditionalRequires"])
            for dependency in option["requires"]:
                flag = applicability.get(dependency)
                if flag and flag != applicability.get(key):
                    edge = {"decision": dependency, "when": {"flag": flag, "equals": True}}
                    if edge not in conditional:
                        conditional.append(edge)
                else:
                    unconditional.append(dependency)
            option["requires"] = unconditional
            option["conditionalRequires"] = conditional
        region = REGIONS.get(key[:1])
        entry = contracts["existingEntryPoints"].get(key)
        records.append({
            "id": key,
            "region": region,
            "question": row["question"],
            "options": options,
            "requires": prerequisites,
            "check": row["check"],
            "sources": row["sources"].split(","),
            "evidenceKind": row["evidence_kind"],
            "status": "proposal",
            "selectionMode": modes.get(key, "single"),
            "responsibleActor": contracts["actorByRegion"].get(region),
            "applicability": {"flag": applicability.get(key), "onUnknown": "request-context", "onFalse": "not-applicable-with-reason-not-pass"},
            "navigation": {
                "kind": "existing-general-entry" if entry else "handoff-planning-only",
                "entry": entry,
                "nextAction": "Open the existing general entry and locate the named control; no new direct-focus route is implemented." if entry else "Record the applicable requirement for the responsible recipient; this catalogue does not implement the control.",
            },
            "actionable": False,
        })
    ids = {r["id"] for r in records}
    if (set(applicability) | set(modes) | set(contracts["existingEntryPoints"])) - ids:
        raise ValueError("Journey contract references an unknown decision")
    if set(contracts["optionOverrides"]) - {o["id"] for r in records for o in r["options"]}:
        raise ValueError("Override references an unknown option")
    validate(records, sources, contracts)
    return {"schemaVersion": 2, "status": "research-proposal", "decisions": records}, sources


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true", help="Generate adjacent decisions.json explicitly")
    args = parser.parse_args()
    catalogue, sources = build()
    encoded = canonical_json(catalogue)
    target = ROOT / "decisions.json"
    if args.write:
        target.write_bytes(encoded)
    elif not target.exists() or target.read_bytes() != encoded:
        raise SystemExit("Generated decisions.json is missing or differs; run with --write and review the diff")
    counts = Counter(r["region"] for r in catalogue["decisions"])
    print(json.dumps({
        "result": "catalogue-structure-consistent",
        "decisions": len(catalogue["decisions"]), "options": 2 * len(catalogue["decisions"]),
        "sources": len(sources), "regions": dict(counts),
        "planningPrerequisites": sum(len(r["requires"]) for r in catalogue["decisions"]),
        "sha256": hashlib.sha256(encoded).hexdigest(),
        "limit": "No UI control, runtime guard, browser task or customer result is verified by this check."
    }, indent=2))


if __name__ == "__main__":
    main()
