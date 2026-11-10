"""Deterministic metadata planning only; no image I/O, model, API or production release.

The caller must obtain authoritative, ownership-filtered records. This module cannot
prove that a hash describes stored bytes or that a person actually viewed a render.
"""
from dataclasses import dataclass, field
from hashlib import sha256
import json
import math
from pathlib import Path
import re
from types import MappingProxyType

SCHEMA = json.loads(Path(__file__).with_name('design_planning.schema.json').read_text())


class InvalidPlan(ValueError):
    """Stable reason code, deliberately excluding customer metadata."""


def _canonical(value):
    if value is None or type(value) in (str, bool, int):
        return value
    if type(value) is float:
        if not math.isfinite(value):
            raise InvalidPlan('NON_FINITE_NUMBER')
        return int(value) if value.is_integer() else value
    if type(value) is list:
        return [_canonical(item) for item in value]
    if type(value) is dict and all(type(key) is str for key in value):
        return {key: _canonical(item) for key, item in value.items()}
    raise InvalidPlan('NON_JSON_VALUE')


def canonical_bytes(value):
    """v1 canonicalization: sorted keys, finite numbers, integral floats normalized."""
    return json.dumps(_canonical(value), sort_keys=True, separators=(',', ':'),
                      ensure_ascii=True, allow_nan=False).encode('ascii')


def fingerprint(value):
    return sha256(b'sonoran-design-planning:v1\x00' + canonical_bytes(value)).hexdigest()


def parse_json(payload):
    """Reject duplicate JSON keys before validation rather than silently replacing them."""
    def pairs(items):
        result = {}
        for key, value in items:
            if key in result:
                raise InvalidPlan('DUPLICATE_JSON_KEY')
            result[key] = value
        return result
    try:
        value = json.loads(payload, object_pairs_hook=pairs)
        canonical_bytes(value)
        return value
    except (TypeError, json.JSONDecodeError, UnicodeDecodeError, RecursionError) as exc:
        raise InvalidPlan('INVALID_JSON') from exc


def _validate(value, schema):
    """Validate the deliberately small JSON Schema subset used by this contract."""
    if '$ref' in schema:
        _validate(value, SCHEMA['$defs'][schema['$ref'].split('/')[-1]])
        return
    if 'anyOf' in schema:
        for choice in schema['anyOf']:
            try:
                _validate(value, choice)
                return
            except InvalidPlan:
                pass
        raise InvalidPlan('SCHEMA_MISMATCH')
    kind = schema['type']
    valid = {'null': value is None, 'boolean': type(value) is bool,
             'integer': type(value) is int,
             'number': type(value) in (int, float), 'string': type(value) is str,
             'array': type(value) is list, 'object': type(value) is dict}[kind]
    if not valid:
        raise InvalidPlan('SCHEMA_TYPE')
    if kind in ('integer', 'number'):
        if type(value) is float and not math.isfinite(value):
            raise InvalidPlan('NON_FINITE_NUMBER')
        if ('minimum' in schema and value < schema['minimum'] or
            'maximum' in schema and value > schema['maximum'] or
            'exclusiveMinimum' in schema and value <= schema['exclusiveMinimum']):
            raise InvalidPlan('NUMBER_RANGE')
    if kind == 'string':
        if 'enum' in schema and value not in schema['enum']:
            raise InvalidPlan('UNKNOWN_ENUM')
        if 'pattern' in schema and re.fullmatch(schema['pattern'], value) is None:
            raise InvalidPlan('INVALID_IDENTIFIER')
    if kind == 'object':
        if set(value) != set(schema['required']):
            raise InvalidPlan('UNKNOWN_OR_MISSING_FIELD')
        for key, child in schema['properties'].items():
            _validate(value[key], child)
    if kind == 'array':
        if not schema['minItems'] <= len(value) <= schema['maxItems']:
            raise InvalidPlan('ARRAY_LENGTH')
        for item in value:
            _validate(item, schema['items'])
        if schema.get('uniqueItems') and len({canonical_bytes(x) for x in value}) != len(value):
            raise InvalidPlan('DUPLICATE_ITEM')


def validate_record(value, kind=None):
    schema = SCHEMA if kind is None else SCHEMA['$defs'][kind]
    _validate(value, schema)
    if kind not in (None, 'original', 'version') or value['kind'] == 'original':
        return
    recipe = value['recipe']
    crop = recipe['crop']
    if crop['x'] + crop['width'] > 1 or crop['y'] + crop['height'] > 1:
        raise InvalidPlan('CROP_OUTSIDE_SOURCE')
    export = recipe['export']
    if export['aspect_ratio'] != export['width_px'] / export['height_px']:
        raise InvalidPlan('ASPECT_RATIO_MISMATCH')
    if value['output'] is not None:
        for field in ('width_px', 'height_px', 'aspect_ratio'):
            if value['output'][field] != export[field]:
                raise InvalidPlan('OUTPUT_DIMENSIONS_MISMATCH')
    if recipe['cleanup'] == 'synthesized' and 'synthesized' not in value['detail_flags']:
        raise InvalidPlan('SYNTHESIS_MUST_BE_DISCLOSED')
    stage = value['kind']
    if stage != 'restoration' and recipe['cleanup'] == 'synthesized':
        raise InvalidPlan('NEW_SYNTHESIS_REQUIRES_SEPARATE_RESTORATION')
    if (stage == 'collage') != (value['collage'] is not None):
        raise InvalidPlan('COLLAGE_FIELDS_MISMATCH')
    if (stage == 'derivative') != (value['target'] is not None):
        raise InvalidPlan('TARGET_FIELDS_MISMATCH')
    if stage != 'collage' and len(value['sources']) != 1:
        raise InvalidPlan('SINGLE_SOURCE_REQUIRED')
    if stage == 'collage':
        subjects = set()
        used_sources = set()
        for placement in value['collage']['placements']:
            if placement['subject_id'] in subjects:
                raise InvalidPlan('DUPLICATE_SUBJECT')
            subjects.add(placement['subject_id'])
            used_sources.add(placement['source_digest'])
            if placement['x'] + placement['width'] > 1 or placement['y'] + placement['height'] > 1:
                raise InvalidPlan('PLACEMENT_OUTSIDE_CANVAS')
        if used_sources != set(value['sources']):
            raise InvalidPlan('COLLAGE_SOURCE_MISMATCH')


@dataclass(frozen=True, init=False)
class PlanningSnapshot:
    """Copied, immutable planning metadata; NOT an authenticated authorization store.

    Empty by default. No real or example merchant qualification ships enabled.
    Adapters must verify ownership, immutable object bytes, review identities,
    revocation and evidence outside this module before supplying records.
    """
    records: object
    reviews: tuple
    renders: tuple
    profiles: tuple

    def __init__(self, records=(), reviews=(), renders=(), profiles=()):
        by_digest = {}
        identities = set()
        for record in records:
            validate_record(record)
            identity = (record['owner_id'], 'original' if record['kind'] == 'original' else 'version',
                        record.get('original_id', record.get('version_id')))
            if identity in identities:
                raise InvalidPlan('REPLACED_IDENTITY')
            identities.add(identity)
            by_digest[fingerprint(record)] = canonical_bytes(record)
        object.__setattr__(self, 'records', MappingProxyType(by_digest))
        for name, values, kind in [('reviews', reviews, 'review'), ('renders', renders, 'render'),
                                    ('profiles', profiles, 'profile')]:
            copied = []
            for item in values:
                validate_record(item, kind)
                copied.append(canonical_bytes(item))
            object.__setattr__(self, name, tuple(copied))


@dataclass(frozen=True)
class PlanResult:
    plan_digest: str
    status: str
    reasons: tuple
    rendered_metadata_present: bool
    production_authorized: bool = field(default=False, init=False)
    machine_ready: bool = field(default=False, init=False)


def plan(candidate, snapshot, *, owner_id, intent='preview', allow_synthetic_profiles=False):
    """Assess an isolated plan; never authorizes payment, production or actual export.

    intent=collage/proof/export additionally requires the candidate's exact rendered
    output review. A preview plan with no render cannot pass that gate.
    """
    if intent not in ('preview', 'collage', 'proof', 'export'):
        raise InvalidPlan('UNKNOWN_INTENT')
    validate_record(candidate, 'version')
    _validate(owner_id, SCHEMA['$defs']['original']['properties']['owner_id'])
    if type(allow_synthetic_profiles) is not bool:
        raise InvalidPlan('SCHEMA_TYPE')
    candidate = json.loads(canonical_bytes(candidate))
    digest = fingerprint(candidate)
    reasons, staff = set(), set()
    reviews = [json.loads(item) for item in snapshot.reviews]
    renders = [json.loads(item) for item in snapshot.renders]
    profiles = [json.loads(item) for item in snapshot.profiles]

    def rendered(node, key):
        return node.get('output') is not None and any(
            r['owner_id'] == owner_id and r['version_digest'] == key and
            r['output'] == node['output'] for r in renders)

    def reviewed(node, key, purpose):
        role = 'staff' if purpose == 'ambiguity' else 'customer'
        return rendered(node, key) and any(
            r['owner_id'] == owner_id and r['version_digest'] == key and
            r['output_sha256'] == node['output']['sha256'] and
            r['purpose'] == purpose and r['actor_role'] == role for r in reviews)

    identities = {}
    original_subjects = {}
    visited = {}
    active = set()

    def visit(node, key, downstream):
        if node['owner_id'] != owner_id:
            raise InvalidPlan('CROSS_OWNER_LINEAGE')
        identity = ('original' if node['kind'] == 'original' else 'version',
                    node.get('original_id', node.get('version_id')))
        if identity in identities and identities[identity] != key:
            raise InvalidPlan('REPLACED_IDENTITY')
        identities[identity] = key
        if key in active:
            raise InvalidPlan('CYCLIC_LINEAGE')
        if node['kind'] == 'original':
            for subject in node['subjects']:
                if subject in original_subjects and original_subjects[subject] != key:
                    raise InvalidPlan('DUPLICATE_SUBJECT_IDENTITY')
                original_subjects[subject] = key
            return set(node['subjects']), set()
        if downstream and not reviewed(node, key, node['kind']):
            reasons.add('SOURCE_RENDER_REVIEW_REQUIRED')
        if key in visited:
            return visited[key]
        if len(active) >= 64:
            raise InvalidPlan('LINEAGE_DEPTH_LIMIT')
        active.add(key)
        sources = {}
        flags = set(node['detail_flags'])
        for source in node['sources']:
            raw = snapshot.records.get(source)
            if raw is None:
                raise InvalidPlan('LINEAGE_MISSING')
            source_node = json.loads(raw)
            if fingerprint(source_node) != source:
                raise InvalidPlan('LINEAGE_HASH_MISMATCH')
            allowed = {'restoration': {'original','restoration'},
                       'collage': {'original','restoration'},
                       'derivative': {'original','restoration','collage'}}[node['kind']]
            if source_node['kind'] not in allowed:
                raise InvalidPlan('INVALID_LINEAGE_STAGE')
            subjects, source_flags = visit(source_node, source, True)
            sources[source] = subjects
            flags.update(source_flags)
        if not flags.issubset(set(node['detail_flags'])):
            raise InvalidPlan('DETAIL_FLAGS_DROPPED')
        if flags and not reviewed(node, key, 'ambiguity'):
            staff.add('UNCERTAIN_OR_SYNTHESIZED_DETAIL_REVIEW')
        subjects = set().union(*sources.values())
        if node['kind'] == 'collage':
            for placement in node['collage']['placements']:
                if placement['subject_id'] not in sources[placement['source_digest']]:
                    raise InvalidPlan('INVENTED_OR_WRONG_SOURCE_SUBJECT')
            subjects = {p['subject_id'] for p in node['collage']['placements']}
        if node['kind'] == 'derivative':
            target = node['target']
            method = target['method']
            if target['technology'] == 'fiber':
                staff.add('FIBER_UNAVAILABLE')
            if method != 'surface':
                if target['machine_id'] != 'jet-mini' or target['material'] != 'crystal' or target['technology'] != 'green':
                    staff.add('SUBSURFACE_MACHINE_MATERIAL_MISMATCH')
                if target['curved']:
                    staff.add('CURVED_JET_MINI_INELIGIBLE')
            if target['machine_id'] == 'jet-mini' and (method == 'surface' or target['curved']):
                staff.add('JET_MINI_METHOD_GEOMETRY_MISMATCH')
            if target['material'] == 'glass' and (method != 'surface' or target['machine_id'] != 'xtool-f2-uv' or target['technology'] != 'uv'):
                staff.add('GLASS_REQUIRES_F2_UV_SURFACE')
            if target['machine_id'] == 'xtool-f2-uv' and (method != 'surface' or target['technology'] != 'uv'):
                staff.add('F2_UV_SURFACE_ONLY')
            matched = [p for p in profiles if p['binding'] == target and
                       (not p['synthetic'] or allow_synthetic_profiles)]
            if not matched:
                staff.add('EXACT_QUALIFIED_PHYSICAL_TEST_PROFILE_REQUIRED')
            if method == 'subsurface_3d':
                staff.add('SUPPLIER_ASSISTED_3D_REVIEW_REQUIRED')
        active.remove(key)
        visited[key] = (subjects, flags)
        return subjects, flags

    # Detect replacement of candidate identity even when the old version is not a parent.
    for raw in snapshot.records.values():
        stored = json.loads(raw)
        if (stored['kind'] != 'original' and stored['owner_id'] == owner_id and
            stored['version_id'] == candidate['version_id'] and fingerprint(stored) != digest):
            raise InvalidPlan('REPLACED_IDENTITY')
    visit(candidate, digest, False)
    if intent != 'preview' and not reviewed(candidate, digest, candidate['kind']):
        reasons.add('EXACT_RENDER_REVIEW_REQUIRED')
    present = rendered(candidate, digest)
    status = ('blocked' if reasons else 'staff_review' if staff else
              'reviewed_preview' if reviewed(candidate, digest, candidate['kind']) else 'planned_preview')
    return PlanResult(digest, status, tuple(sorted(reasons | staff)), present)
