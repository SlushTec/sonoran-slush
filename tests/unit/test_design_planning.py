"""Synthetic metadata only. No customer files, real qualification or image processing."""
from copy import deepcopy
import json
from pathlib import Path
import unittest

from services.assistant.design_planning import (
    InvalidPlan, PlanningSnapshot, canonical_bytes, fingerprint, parse_json, plan,
    validate_record,
)


def original(name='source-a', owner='synthetic-owner', subject='subject-a'):
    return dict(schema_version='1', kind='original', owner_id=owner, original_id=name,
                source_sha256='a'*64, width_px=1200, height_px=800, subjects=[subject])


def version(source, kind='restoration', name='version-a'):
    return dict(schema_version='1', kind=kind, owner_id='synthetic-owner', version_id=name,
                sources=[fingerprint(source)], recipe=dict(version=1,
                crop=dict(x=0,y=0,width=1,height=1), background='preserve',
                tonal=dict(brightness=0,contrast=0), cleanup='none',
                export=dict(format='png',width_px=1200,height_px=800,aspect_ratio=1.5)),
                output=None, detail_flags=[], collage=None, target=None)


def binding(**changes):
    value = dict(product_id='synthetic-product', blank_id='synthetic-blank',
                 blank_revision='1',material='crystal',finish='polished',coating='none',
                 dimensions=dict(width_mm=60,height_mm=80,depth_mm=30),
                 geometry_id='synthetic-flat-entry-geometry',geometry_revision='1',curved=False,
                 method='subsurface_2d',machine_id='jet-mini',technology='green',
                 profile_id='synthetic-profile',profile_version='1')
    value.update(changes)
    return value


def derivative(source, **changes):
    value=version(source,'derivative',name='derivative-a')
    value['target']=binding(**changes)
    return value


def collage(*sources):
    value=version(sources[0],'collage')
    value['sources']=[fingerprint(s) for s in sources]
    value['collage']=dict(layout_version=1,placements=[dict(
        source_digest=fingerprint(s),subject_id=s['subjects'][0],
        x=i/len(sources),y=0,width=1/len(sources),height=1,scale=1,rotation_degrees=0)
        for i,s in enumerate(sources)])
    return value


def rendered(value):
    value=deepcopy(value)
    value['output']=dict(sha256='b'*64,width_px=1200,height_px=800,aspect_ratio=1.5)
    return value


def render_evidence(value):
    return dict(owner_id=value['owner_id'],version_digest=fingerprint(value),
                output=deepcopy(value['output']),renderer_evidence_sha256='c'*64)


def review(value, purpose=None, role='customer'):
    return dict(owner_id=value['owner_id'],version_digest=fingerprint(value),
                output_sha256=value['output']['sha256'],purpose=purpose or value['kind'],
                actor_id='synthetic-reviewer',actor_role=role,evidence_sha256='d'*64)


def profile(value):
    return dict(binding=deepcopy(value['target']),qualification_evidence_sha256='e'*64,
                physical_test_evidence_sha256='f'*64,staff_review_evidence_sha256='1'*64,
                synthetic=True)


class DesignPlanningTests(unittest.TestCase):
    def setUp(self):
        self.source=original()
        self.restored=rendered(version(self.source))

    def assess(self, candidate, *, records=None, reviews=(), renders=(), profiles=(), intent='preview', synthetic=False):
        return plan(candidate,PlanningSnapshot(records if records is not None else [self.source],
                    reviews,renders,profiles),owner_id='synthetic-owner',intent=intent,
                    allow_synthetic_profiles=synthetic)

    def test_original_is_preserved_and_snapshot_copies_inputs(self):
        source=deepcopy(self.source)
        snapshot=PlanningSnapshot([source])
        candidate=version(source)
        before=deepcopy(candidate)
        source['source_sha256']='9'*64
        result=plan(candidate,snapshot,owner_id='synthetic-owner')
        self.assertEqual(result.status,'planned_preview')
        self.assertEqual(candidate,before)
        self.assertEqual(json.loads(next(iter(snapshot.records.values()))),self.source)
        with self.assertRaises(TypeError): snapshot.records['bad']=b'{}'
        self.assertFalse(result.machine_ready)
        self.assertFalse(result.production_authorized)

    def test_hash_is_deterministic_order_independent_and_numeric_normalized(self):
        self.assertEqual(fingerprint({'b':2,'a':1}),fingerprint({'a':1.0,'b':2}))
        self.assertEqual(canonical_bytes({'z':-0.0}),b'{"z":0}')
        self.assertNotEqual(fingerprint(self.source),self.source['source_sha256'])

    def test_canonical_rejects_non_json_and_nonfinite(self):
        for bad in [float('nan'),float('inf'),-float('inf'),set(),{1:'x'},object()]:
            with self.subTest(bad=type(bad)),self.assertRaises(InvalidPlan): fingerprint(bad)

    def test_json_duplicate_keys_and_nonfinite_rejected(self):
        for bad in ['{"a":1,"a":2}','{"x":NaN}','{"x":Infinity}','{broken']:
            with self.subTest(bad=bad),self.assertRaises(InvalidPlan): parse_json(bad)

    def test_unknown_missing_fields_and_approval_boolean_rejected(self):
        for key in ['approved','production_authorized','customer_email']:
            value=version(self.source); value[key]=True
            with self.subTest(key=key),self.assertRaises(InvalidPlan): self.assess(value)
        value=version(self.source); del value['recipe']['crop']['x']
        with self.assertRaises(InvalidPlan): self.assess(value)

    def test_strict_numbers_all_boundaries(self):
        for bad in [True,False,float('nan'),float('inf'),-1,0,100001,'100']:
            value=version(self.source); value['recipe']['export']['width_px']=bad
            with self.subTest(bad=bad),self.assertRaises(InvalidPlan): self.assess(value)
        for bad in [True,float('nan'),float('inf'),0,-1,'60']:
            value=derivative(self.source); value['target']['dimensions']['width_mm']=bad
            with self.subTest(bad=bad),self.assertRaises(InvalidPlan): self.assess(value)
        for bad in [True,float('nan'),float('inf'),2,-1]:
            value=version(self.source); value['recipe']['crop']['x']=bad
            with self.subTest(bad=bad),self.assertRaises(InvalidPlan): self.assess(value)

    def test_invalid_crop_and_aspect_and_output_dimensions(self):
        values=[]
        v=version(self.source); v['recipe']['crop']['x']=.1; values.append(v)
        v=version(self.source); v['recipe']['export']['aspect_ratio']=2; values.append(v)
        v=deepcopy(self.restored); v['output']['width_px']=100; values.append(v)
        for value in values:
            with self.subTest(value=value['output']),self.assertRaises(InvalidPlan): self.assess(value)

    def test_duplicate_original_subject_and_source_rejected(self):
        source=original(); source['subjects']*=2
        with self.assertRaises(InvalidPlan): PlanningSnapshot([source])
        value=version(self.source); value['sources']*=2
        with self.assertRaises(InvalidPlan): self.assess(value)

    def test_cross_owner_input_and_candidate_rejected(self):
        source=original(owner='other-owner')
        with self.assertRaisesRegex(InvalidPlan,'CROSS_OWNER'): self.assess(version(source),records=[source])
        value=version(self.source); value['owner_id']='other-owner'
        with self.assertRaisesRegex(InvalidPlan,'CROSS_OWNER'): self.assess(value)

    def test_missing_replaced_lineage_and_reused_identity(self):
        value=version(self.source); value['sources']=['0'*64]
        with self.assertRaisesRegex(InvalidPlan,'LINEAGE_MISSING'): self.assess(value)
        source=deepcopy(self.source); source['source_sha256']='9'*64
        with self.assertRaisesRegex(InvalidPlan,'LINEAGE_MISSING'): self.assess(version(self.source),records=[source])
        with self.assertRaisesRegex(InvalidPlan,'REPLACED_IDENTITY'): PlanningSnapshot([source,self.source])
        changed=deepcopy(self.restored); changed['recipe']['version']=2
        with self.assertRaisesRegex(InvalidPlan,'REPLACED_IDENTITY'):
            self.assess(changed,records=[self.source,self.restored])

    def test_invalid_derivative_as_restoration_source(self):
        source=derivative(self.source)
        value=version(source,name='different-version')
        with self.assertRaisesRegex(InvalidPlan,'INVALID_LINEAGE_STAGE'):
            self.assess(value,records=[self.source,source])

    def test_unrendered_plan_cannot_be_approved_for_downstream_intents(self):
        value=version(self.source)
        for intent in ['collage','proof','export']:
            result=self.assess(value,intent=intent)
            self.assertEqual(result.status,'blocked')
            self.assertIn('EXACT_RENDER_REVIEW_REQUIRED',result.reasons)
            self.assertFalse(result.rendered_metadata_present)

    def test_hash_claim_and_review_without_render_evidence_do_not_pass(self):
        result=self.assess(self.restored,reviews=[review(self.restored)],intent='export')
        self.assertEqual(result.status,'blocked')
        self.assertFalse(result.rendered_metadata_present)

    def test_exact_render_review_is_still_never_production_authorization(self):
        result=self.assess(self.restored,reviews=[review(self.restored)],
                           renders=[render_evidence(self.restored)],intent='export')
        self.assertEqual(result.status,'reviewed_preview')
        self.assertFalse(result.production_authorized)
        self.assertFalse(result.machine_ready)

    def test_stale_restoration_review_all_changed_content(self):
        for mutation in ['recipe','output','dimensions','source','version']:
            value=deepcopy(self.restored)
            records=[self.source]
            if mutation=='recipe': value['recipe']['tonal']['brightness']=.2
            if mutation=='output': value['output']['sha256']='9'*64
            if mutation=='dimensions':
                for field in [value['output'],value['recipe']['export']]:
                    field['width_px']=800; field['aspect_ratio']=1
            if mutation=='source':
                source=original('source-b',subject='subject-b');records.append(source)
                value['sources']=[fingerprint(source)]
            if mutation=='version': value['version_id']='version-b'
            with self.subTest(mutation=mutation):
                result=self.assess(value,records=records,reviews=[review(self.restored)],
                                   renders=[render_evidence(value)],intent='export')
                self.assertEqual(result.status,'blocked')

    def test_wrong_owner_role_purpose_and_output_reviews_do_not_pass(self):
        for key,new in [('owner_id','other-owner'),('actor_role','staff'),
                        ('purpose','collage'),('output_sha256','9'*64)]:
            receipt=review(self.restored);receipt[key]=new
            with self.subTest(key=key):
                result=self.assess(self.restored,reviews=[receipt],renders=[render_evidence(self.restored)],intent='export')
                self.assertEqual(result.status,'blocked')

    def test_restore_must_be_reviewed_before_collage_or_derivative(self):
        value=derivative(self.restored)
        result=self.assess(value,records=[self.source,self.restored],renders=[render_evidence(self.restored)])
        self.assertIn('SOURCE_RENDER_REVIEW_REQUIRED',result.reasons)
        result=self.assess(value,records=[self.source,self.restored],renders=[render_evidence(self.restored)],reviews=[review(self.restored)])
        self.assertNotIn('SOURCE_RENDER_REVIEW_REQUIRED',result.reasons)

    def test_restored_collage_source_needs_its_exact_output_approval(self):
        value=collage(self.source)
        value['version_id']='collage-restored'
        value['sources']=[fingerprint(self.restored)]
        value['collage']['placements'][0]['source_digest']=fingerprint(self.restored)
        result=self.assess(value,records=[self.source,self.restored],
                           renders=[render_evidence(self.restored)])
        self.assertIn('SOURCE_RENDER_REVIEW_REQUIRED',result.reasons)
        result=self.assess(value,records=[self.source,self.restored],
                           renders=[render_evidence(self.restored)],reviews=[review(self.restored)])
        self.assertEqual(result.status,'planned_preview')

    def test_synthesis_requires_disclosure_and_staff_route(self):
        value=version(self.source);value['recipe']['cleanup']='synthesized'
        with self.assertRaisesRegex(InvalidPlan,'SYNTHESIS'): self.assess(value)
        value['detail_flags']=['synthesized','uncertain']
        self.assertEqual(self.assess(value).status,'staff_review')
        value=rendered(value)
        result=self.assess(value,reviews=[review(value),review(value,'ambiguity','staff')],
                           renders=[render_evidence(value)],intent='export')
        self.assertEqual(result.status,'reviewed_preview')
        self.assertFalse(result.machine_ready)

    def test_detail_flags_cannot_be_laundered_in_descendant(self):
        source=deepcopy(self.restored);source['detail_flags']=['uncertain']
        with self.assertRaisesRegex(InvalidPlan,'DETAIL_FLAGS_DROPPED'):
            self.assess(derivative(source),records=[self.source,source])

    def test_collage_explicit_layout_and_sources(self):
        other=original('source-b',subject='subject-b')
        value=collage(self.source,other)
        self.assertEqual(self.assess(value,records=[self.source,other]).status,'planned_preview')
        self.assertFalse(self.assess(value,records=[self.source,other]).machine_ready)

    def test_collage_duplicate_missing_and_invented_subjects(self):
        other=original('source-b',subject='subject-b')
        for mutation in ['duplicate','invented','wrong-source','missing-source','outside','bool-scale']:
            value=collage(self.source,other); p=value['collage']['placements']
            if mutation=='duplicate': p[1]['subject_id']=p[0]['subject_id']
            if mutation=='invented': p[1]['subject_id']='invented-person'
            if mutation=='wrong-source': p[1]['subject_id']='subject-a';p[0]['subject_id']='subject-b'
            if mutation=='missing-source': p.pop()
            if mutation=='outside': p[1]['x']=.9
            if mutation=='bool-scale': p[1]['scale']=True
            with self.subTest(mutation=mutation),self.assertRaises(InvalidPlan):
                self.assess(value,records=[self.source,other])

    def test_changed_collage_layout_scale_and_source_invalidate_review(self):
        other=original('source-b',subject='subject-b')
        value=rendered(collage(self.source,other))
        for mutation in ['layout','scale','source-order','source','rotation']:
            changed=deepcopy(value)
            if mutation=='layout': changed['collage']['layout_version']=2
            if mutation=='scale': changed['collage']['placements'][0]['scale']=.9
            if mutation=='rotation': changed['collage']['placements'][0]['rotation_degrees']=15
            records=[self.source,other]
            if mutation=='source-order':
                changed['sources'].reverse()
            if mutation=='source':
                replacement=original('source-replacement',subject='subject-a')
                replacement['source_sha256']='9'*64
                records.append(replacement)
                changed['sources'][0]=fingerprint(replacement)
                changed['collage']['placements'][0]['source_digest']=fingerprint(replacement)
            with self.subTest(mutation=mutation):
                result=self.assess(changed,records=records,reviews=[review(value)],
                                   renders=[render_evidence(changed)],intent='export')
                self.assertEqual(result.status,'blocked')

    def test_empty_and_synthetic_profiles_default_unavailable(self):
        value=derivative(self.source)
        for profiles in [[],[profile(value)]]:
            result=self.assess(value,profiles=profiles)
            self.assertIn('EXACT_QUALIFIED_PHYSICAL_TEST_PROFILE_REQUIRED',result.reasons)
            self.assertEqual(result.status,'staff_review')

    def test_synthetic_profile_only_allows_planning_in_explicit_test_mode(self):
        value=derivative(self.source)
        result=self.assess(value,profiles=[profile(value)],synthetic=True)
        self.assertEqual(result.status,'planned_preview')
        self.assertFalse(result.machine_ready)

    def test_missing_physical_test_or_qualification_is_rejected(self):
        value=derivative(self.source)
        for key in ['physical_test_evidence_sha256','qualification_evidence_sha256','staff_review_evidence_sha256']:
            evidence=profile(value);del evidence[key]
            with self.subTest(key=key),self.assertRaises(InvalidPlan): self.assess(value,profiles=[evidence])

    def test_unknown_profile_and_geometry_revision_remain_unavailable(self):
        value=derivative(self.source); evidence=profile(value)
        for key in value['target']:
            changed=deepcopy(value)
            if key=='dimensions': changed['target'][key]['width_mm']=61
            elif key=='curved': changed['target'][key]=True
            elif key=='method': changed['target'][key]='subsurface_3d'
            elif key=='technology': changed['target'][key]='uv'
            else: changed['target'][key]='different'
            with self.subTest(key=key):
                result=self.assess(changed,profiles=[evidence],synthetic=True)
                self.assertIn('EXACT_QUALIFIED_PHYSICAL_TEST_PROFILE_REQUIRED',result.reasons)

    def test_curved_jet_mini_rejected_even_with_exact_synthetic_profile(self):
        for name in ['rectangle','sphere','unknown-custom-blank']:
            value=derivative(self.source,curved=True,blank_id=name)
            result=self.assess(value,profiles=[profile(value)],synthetic=True)
            self.assertIn('CURVED_JET_MINI_INELIGIBLE',result.reasons)
            self.assertEqual(result.status,'staff_review')
        value=derivative(self.source,blank_id='sphere-label-but-flat-qualified-entry')
        result=self.assess(value,profiles=[profile(value)],synthetic=True)
        self.assertNotIn('CURVED_JET_MINI_INELIGIBLE',result.reasons)

    def test_xtool_uv_surface_and_subsurface_are_distinct(self):
        for method in ['surface','subsurface_2d','subsurface_3d']:
            value=derivative(self.source,material='glass',method=method,machine_id='xtool-f2-uv',technology='uv')
            result=self.assess(value,profiles=[profile(value)],synthetic=True)
            self.assertEqual(result.status,'planned_preview' if method=='surface' else 'staff_review')
            if method!='surface': self.assertIn('F2_UV_SURFACE_ONLY',result.reasons)

    def test_fiber_and_jet_surface_unavailable(self):
        for changes,reason in [({'technology':'fiber'},'FIBER_UNAVAILABLE'),
                               ({'method':'surface'},'JET_MINI_METHOD_GEOMETRY_MISMATCH')]:
            value=derivative(self.source,**changes)
            result=self.assess(value,profiles=[profile(value)],synthetic=True)
            self.assertIn(reason,result.reasons)

    def test_co2_diode_ir_require_exact_qualification_and_test_evidence(self):
        for tech in ['co2','diode','ir']:
            value=derivative(self.source,material='wood',method='surface',machine_id='synthetic-machine',technology=tech)
            self.assertEqual(self.assess(value).status,'staff_review')
            self.assertEqual(self.assess(value,profiles=[profile(value)],synthetic=True).status,'planned_preview')

    def test_3d_always_routes_to_supplier_assisted_staff_review(self):
        value=derivative(self.source,method='subsurface_3d')
        result=self.assess(value,profiles=[profile(value)],synthetic=True)
        self.assertIn('SUPPLIER_ASSISTED_3D_REVIEW_REQUIRED',result.reasons)
        self.assertFalse(result.machine_ready)

    def test_every_product_binding_change_invalidates_prior_output_review(self):
        value=rendered(derivative(self.source))
        changes=dict(product_id='other-product',blank_id='other-blank',blank_revision='2',
                     material='glass',finish='matte',coating='painted',geometry_id='other-geometry',
                     geometry_revision='2',method='subsurface_3d',machine_id='other-machine',
                     technology='uv',profile_id='other-profile',profile_version='2',curved=True,
                     dimensions=dict(width_mm=61,height_mm=80,depth_mm=30))
        for key,new in changes.items():
            changed=deepcopy(value);changed['target'][key]=new
            with self.subTest(key=key):
                result=self.assess(changed,reviews=[review(value)],renders=[render_evidence(changed)],
                                   profiles=[profile(changed)],synthetic=True,intent='export')
                self.assertIn('EXACT_RENDER_REVIEW_REQUIRED',result.reasons)
                self.assertFalse(result.production_authorized)

    def test_new_product_preview_does_not_inherit_restored_master_approval(self):
        value=rendered(derivative(self.restored));value['version_id']='product-version'
        result=self.assess(value,records=[self.source,self.restored],reviews=[review(self.restored)],
                           renders=[render_evidence(self.restored),render_evidence(value)],
                           profiles=[profile(value)],synthetic=True,intent='export')
        self.assertIn('EXACT_RENDER_REVIEW_REQUIRED',result.reasons)

    def test_collage_cannot_request_new_synthetic_features(self):
        value=collage(self.source)
        value['recipe']['cleanup']='synthesized'
        value['detail_flags']=['synthesized']
        with self.assertRaisesRegex(InvalidPlan,'NEW_SYNTHESIS'):
            self.assess(value)

    def test_subject_identity_cannot_be_duplicated_across_originals(self):
        other=original('source-b',subject='subject-a')
        value=collage(self.source,other)
        # Validation catches duplicate placements before the lineage check.
        with self.assertRaisesRegex(InvalidPlan,'DUPLICATE_SUBJECT'):
            self.assess(value,records=[self.source,other])

    def test_all_recipe_edits_invalidate_render_review(self):
        for mutation in ['crop','background','contrast','cleanup','recipe-version','format']:
            changed=deepcopy(self.restored)
            if mutation=='crop':changed['recipe']['crop']['width']=.9
            if mutation=='background':changed['recipe']['background']='remove'
            if mutation=='contrast':changed['recipe']['tonal']['contrast']=.2
            if mutation=='cleanup':changed['recipe']['cleanup']='conservative'
            if mutation=='recipe-version':changed['recipe']['version']=2
            if mutation=='format':changed['recipe']['export']['format']='svg'
            with self.subTest(mutation=mutation):
                result=self.assess(changed,reviews=[review(self.restored)],
                                   renders=[render_evidence(changed)],intent='proof')
                self.assertIn('EXACT_RENDER_REVIEW_REQUIRED',result.reasons)

    def test_unknown_geometry_flags_cannot_be_truthy_strings(self):
        value=derivative(self.source);value['target']['curved']='false'
        with self.assertRaises(InvalidPlan):self.assess(value)
        value=derivative(self.source);del value['target']['geometry_revision']
        with self.assertRaises(InvalidPlan):self.assess(value)

    def test_deep_lineage_fails_closed_with_fixed_code(self):
        records=[self.source]
        source=self.source
        for index in range(65):
            source=version(source,name='chain-'+str(index));records.append(source)
        value=version(source,name='chain-end')
        with self.assertRaisesRegex(InvalidPlan,'LINEAGE_DEPTH_LIMIT'):
            self.assess(value,records=records)

    def test_schema_is_standalone_strict_and_has_no_enabled_profiles(self):
        schema=json.loads(Path('services/assistant/design_planning.schema.json').read_text())
        self.assertEqual(schema['$schema'],'https://json-schema.org/draft/2020-12/schema')
        self.assertEqual(PlanningSnapshot().profiles,())
        def walk(node):
            if isinstance(node,dict):
                if node.get('type')=='object': self.assertFalse(node['additionalProperties'])
                for child in node.values():walk(child)
            elif isinstance(node,list):
                for child in node:walk(child)
        walk(schema)


if __name__=='__main__': unittest.main()
