from concurrent.futures import ThreadPoolExecutor
import json
import os
import sqlite3
from uuid import UUID
import pytest
from test_commerce_workflows import connected, staff, auth, proof, order
from test_retail_durability import setup, cart, purchase, simulate, release
from services.commerce.app.workflows import database, load, save
from services.commerce.app import proof_evidence as evidence


def prepared(c,m):
    setup(c,m,count=20);o=purchase(c,cart(c)).json();p=proof(c,o)
    return o,p


def decide(c,p,version=1,decision='approve',comment=''):
    return c.post('/v1/proofs/'+p['id']+('/approve' if decision=='approve' else '/changes'),
                  headers=auth(p),json={'version':version,'decision':decision,'comment':comment})


def history(c,p,version=None):
    return c.get('/v1/proofs/'+p['id']+'/history'+('' if version is None else '/'+str(version)),headers=auth(p))


def dump():
    with sqlite3.connect(os.environ['SONORAN_DB_PATH']) as db:return list(db.iterdump())


def test_revision_history_preserves_wording_decisions_and_deduplicates(connected,monkeypatch):
    o,p=prepared(connected,monkeypatch)
    assert decide(connected,p,comment='first approval').status_code==200
    before=history(connected,p,1).json()
    proof(connected,o,1)
    assert history(connected,p,1).json()==before
    assert before['revision']['proof_text']=='Reviewed inscription version 1'
    assert before['decisions'][0]['comment']=='first approval'
    assert before['decisions'][0]['actor_scope']=='holder of this private proof capability'
    assert history(connected,p,2).json()['revision']['proof_text']=='Reviewed inscription version 2'
    with database() as db:
        assert db.execute('SELECT count(*) FROM proof_material_contexts').fetchone()[0]==1
        assert db.execute('SELECT count(*) FROM proof_revision_evidence').fetchone()[0]==2
    assert decide(connected,p).status_code==409


def test_exact_decision_replay_and_conflicting_comment(connected,monkeypatch):
    o,p=prepared(connected,monkeypatch)
    first=decide(connected,p,comment='same');assert first.status_code==200
    before=dump()
    assert decide(connected,p,comment='same').json()==first.json()
    assert dump()==before
    assert decide(connected,p,comment='different').status_code==409
    assert decide(connected,p,decision='changes',comment='new wording please').status_code==200
    assert decide(connected,p,decision='changes',comment='new wording please').status_code==200
    assert decide(connected,p,decision='changes',comment='other').status_code==409
    data=history(connected,p,1).json()
    assert [d['action'] for d in data['decisions']]==['approve','changes']
    assert decide(connected,p).status_code==409


@pytest.mark.parametrize('field',['total_minor','currency','items','lines'])
def test_material_tamper_denies_approval_without_writes(connected,monkeypatch,field):
    o,p=prepared(connected,monkeypatch)
    with database() as db:
        doc=load(db,o['id'])
        if field=='total_minor':doc[field]+=1
        elif field=='currency':doc[field]='EUR'
        elif field=='items':doc[field][0]['text']='Changed spelling'
        else:doc[field][0]['item']['text']='Changed line'
        save(db,doc)
    before=dump()
    assert decide(connected,p).status_code==409
    assert dump()==before


def test_nonmaterial_changes_do_not_stale_proof(connected,monkeypatch):
    o,p=prepared(connected,monkeypatch)
    assert simulate(connected,o).status_code==200
    assert connected.post('/v1/admin/retail-test/orders/'+o['id']+'/capacity',headers=staff(),json={'version':1,'confirmed':True}).status_code==200
    assert decide(connected,p).status_code==200
    assert release(connected,o).status_code==200
    before=dump()
    assert release(connected,o).status_code==200
    assert dump()==before


def test_release_verifies_proof_not_only_order_flags(connected,monkeypatch):
    o,p=prepared(connected,monkeypatch)
    assert simulate(connected,o).status_code==200
    with database() as db:
        doc=load(db,o['id']);doc.update(proof_status='approved',approved_proof_version=1,capacity_confirmed=True);save(db,doc)
    before=dump()
    assert release(connected,o).status_code==409
    assert dump()==before


def legacy(c,m):
    o,p=prepared(c,m)
    with database() as db:
        doc=load(db,p['id'])
        for k in ('binding_schema','context_hash','limitations'):doc.pop(k,None)
        save(db,doc)
        for table in ('proof_revision_evidence','proof_decision_evidence','proof_material_contexts','proof_legacy_observations'):
            db.execute('DROP TABLE '+table)
    return o,p


def test_legacy_read_never_migrates_and_requires_new_revision(connected,monkeypatch):
    o,p=legacy(connected,monkeypatch)
    before=dump()
    assert connected.get('/v1/proofs/'+p['id'],headers=auth(p)).status_code==200
    assert history(connected,p).json()['legacy_history_unknown'] is True
    assert history(connected,p).json()['items']==[]
    assert history(connected,p,1).status_code==409
    assert decide(connected,p).status_code==409
    assert dump()==before
    proof(connected,o,1)
    assert decide(connected,p,version=2).status_code==200
    result=history(connected,p).json()
    assert result['legacy_observation']['version']==1
    assert [r['version'] for r in result['items']]==[2]
    assert history(connected,p,1).status_code==409
    with database() as db:
        raw=json.loads(db.execute('SELECT document FROM proof_legacy_observations').fetchone()[0])
        assert raw['proof_text']=='Reviewed inscription version 1'
        assert 'context_hash' not in raw


@pytest.mark.parametrize('table',['proof_material_contexts','proof_revision_evidence','proof_decision_evidence'])
def test_final_evidence_write_failure_rolls_back(connected,monkeypatch,table):
    o,p=prepared(connected,monkeypatch)
    with database() as db:
        db.execute("CREATE TRIGGER fail_evidence BEFORE INSERT ON "+table+" BEGIN SELECT RAISE(ABORT,'test fault'); END")
        if table=='proof_material_contexts':
            doc=load(db,o['id']);doc['items'][0]['notes']='new test material';doc['lines'][0]['item']['notes']='new test material';save(db,doc)
    before=dump()
    with pytest.raises(sqlite3.IntegrityError):
        if table=='proof_decision_evidence':decide(connected,p)
        else:proof(connected,o,1)
    assert dump()==before


def test_final_order_write_failure_rolls_back_history(connected,monkeypatch):
    o,p=prepared(connected,monkeypatch)
    with database() as db:
        db.execute("CREATE TRIGGER fail_order BEFORE UPDATE ON records WHEN NEW.kind='order' BEGIN SELECT RAISE(ABORT,'fault'); END")
    before=dump()
    with pytest.raises(sqlite3.IntegrityError):decide(connected,p)
    assert dump()==before


def test_competing_prepare_and_decisions(connected,monkeypatch):
    o,p=prepared(connected,monkeypatch)
    def prepare(_):return connected.post('/v1/admin/proofs',headers=staff(),json={'order_id':o['id'],'expected_proof_version':1,'proof_text':'next'})
    with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(prepare,range(4)))
    assert sorted(r.status_code for r in results)==[200,409,409,409]
    with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(lambda _:decide(connected,p,2),range(4)))
    assert all(r.status_code==200 for r in results)
    assert len(history(connected,p,2).json()['decisions'])==1


def test_bounded_history_authorization_and_no_blob_loading(connected,monkeypatch):
    o,p=prepared(connected,monkeypatch);proof(connected,o,1);proof(connected,o,2)
    r=connected.get('/v1/proofs/'+p['id']+'/history?limit=1',headers=auth(p)).json()
    assert len(r['items'])==1 and r['next_cursor']==1
    assert 'material_context' not in r and 'proof_text' not in r['items'][0]
    assert connected.get('/v1/proofs/'+p['id']+'/history?limit=26',headers=auth(p)).status_code==422
    assert connected.get('/v1/proofs/'+p['id']+'/history?after=-1',headers=auth(p)).status_code==422
    assert connected.get('/v1/proofs/'+p['id']+'/history').status_code==404
    with database() as db:db.execute("UPDATE proof_material_contexts SET document='not-json'")
    # Metadata page does not load or emit material blobs; exact read validates them.
    assert history(connected,p).status_code==200
    assert history(connected,p,1).status_code==409


@pytest.mark.parametrize('target',['context','revision','decision','rootless'])
def test_malformed_evidence_bounded(connected,monkeypatch,target):
    o,p=prepared(connected,monkeypatch);assert decide(connected,p).status_code==200
    with database() as db:
        if target=='context':db.execute("UPDATE proof_material_contexts SET document=?", (b'\xff',))
        elif target=='revision':db.execute("UPDATE proof_revision_evidence SET document='[]'")
        elif target=='decision':db.execute("UPDATE proof_decision_evidence SET document='null'")
        else:db.execute('DELETE FROM proof_revision_evidence')
    before=dump()
    assert decide(connected,p).status_code==409
    assert dump()==before


def test_crossorder_linkage_and_hash_collision(connected,monkeypatch):
    o,p=prepared(connected,monkeypatch)
    with database() as db:
        db.execute("UPDATE proof_material_contexts SET order_id='other'")
    assert history(connected,p,1).status_code==409
    assert connected.post('/v1/admin/proofs',headers=staff(),json={'order_id':o['id'],'expected_proof_version':1,'proof_text':'next'}).status_code==409


def test_legacy_surrogate_fails_bounded_not_encoded(connected,monkeypatch):
    o,p=prepared(connected,monkeypatch)
    with database() as db:
        doc=load(db,o['id']);doc['items'][0]['notes']='\ud800';doc['lines'][0]['item']['notes']='\ud800';save(db,doc)
    assert decide(connected,p).status_code==409
    assert connected.post('/v1/admin/proofs',headers=staff(),json={'order_id':o['id'],'expected_proof_version':1,'proof_text':'next'}).status_code==409


def test_material_capacity_accepts_worst_valid_current_models():
    from services.commerce.app.retail import CartRequest
    from services.commerce.app.piece_personalization import piece_snapshot
    c='\x01';emoji='\U0001f33c'
    def full(structured):
        d={'product_slug':'makertwist-40oz-tumbler','quantity':5 if structured else 1,'text':'' if structured else c*120,'secondary':'' if structured else c*120,'font':'Classic serif',
           'options':{} if structured else {chr(33+i)+c*59:c*200 for i in range(16)},'notes':c*1500,'artwork_name':c*255,'gift':True,'gift_message':c*300,
           'photo_brief':{'instructions':c*2000,'photos':[{'local_file_id':str(UUID(int=i+1)),'filename':c*255,'note':c*500} for i in range(8)]}}
        if structured:d['personalization']={'mode':'per_piece','pieces':[{'set_index':s,'piece_index':p,'text':emoji*120} for s in range(5) for p in range(100)]}
        return d
    data=CartRequest.model_validate({'request_id':str(UUID(int=123)),'items':[full(i<4) for i in range(100)]}).model_dump(mode='json')
    lines=[]
    for i,item in enumerate(data['items']):
        line={'item':item,'offer_version':1,'unit_price_minor':1,'line_total_minor':item['quantity'],'stock_id':'s'*100,'stock_units':item['quantity']}
        mapping=piece_snapshot(item,{'pieces_per_item':100},i)
        if mapping:line['personalization_snapshot']=mapping
        lines.append(line)
    order={'id':'ord_'+'f'*32,'items':data['items'],'lines':lines,'total_minor':sum(x['line_total_minor'] for x in lines),'currency':'USD'}
    context,raw,digest=evidence.material(order)
    assert len(raw)>19*1024*1024 and len(raw)<24*1024*1024
    # Conservative envelope: duplicated100 full items incl JSON fixed structure at6 bytes/char,
    # plus2000 mapped120-codepoint inscriptions in3 copies and5000 bytes/line numeric/stock overhead.
    envelope=17000*6*2*100+2000*(120*4+120)*3+100*5000
    assert len(raw)<envelope<24*1024*1024<evidence.MAX_CONTEXT
    assert evidence.material(order)[2]==digest


@pytest.mark.parametrize('field,value',[('binding_schema',True),('version',True),('kind','order'),('context_hash','0'*64),('order_id','other')])
def test_corrupt_current_proof_linkage(connected,monkeypatch,field,value):
    o,p=prepared(connected,monkeypatch)
    with database() as db:
        doc=load(db,p['id']);doc[field]=value;save(db,doc)
    before=dump()
    assert decide(connected,p).status_code in (404,409)
    assert dump()==before


def test_changed_material_reprepare_records_new_context(connected,monkeypatch):
    o,p=prepared(connected,monkeypatch)
    first=history(connected,p,1).json()
    with database() as db:
        doc=load(db,o['id']);doc['items'][0]['text']='Updated';doc['lines'][0]['item']['text']='Updated';save(db,doc)
    proof(connected,o,1)
    second=history(connected,p,2).json()
    assert first['revision']['context_hash']!=second['revision']['context_hash']
    assert history(connected,p,1).json()==first
    assert decide(connected,p,2).status_code==200


def test_history_cannot_open_other_proof(connected,monkeypatch):
    o,p=prepared(connected,monkeypatch)
    other=purchase(connected,cart(connected)).json();q=proof(connected,other)
    assert connected.get('/v1/proofs/'+q['id']+'/history',headers=auth(p)).status_code==404
    assert connected.get('/v1/proofs/'+q['id']+'/history/1',headers=auth(p)).status_code==404


def test_context_collision_does_not_overwrite(connected,monkeypatch):
    o,p=prepared(connected,monkeypatch)
    with database() as db:
        digest=db.execute('SELECT hash FROM proof_material_contexts').fetchone()[0]
        db.execute("UPDATE proof_material_contexts SET document='{}' WHERE hash=?",(digest,))
    before=dump()
    assert connected.post('/v1/admin/proofs',headers=staff(),json={'order_id':o['id'],'expected_proof_version':1,'proof_text':'next'}).status_code==409
    assert dump()==before


def test_empty_legacy_bulk_stays_readable_but_cannot_bind_unknown_config(connected):
    from test_commerce_workflows import inquiry,offer_accept
    q=connected.post('/v1/quotes',json=inquiry('bulk')).json()
    offer_accept(connected,q)
    o=connected.post('/v1/admin/orders',headers=staff(),json={'quote_id':q['id'],'version':2}).json()
    existing=connected.get('/v1/orders/'+o['id'],headers=auth(o))
    assert existing.status_code==200 and existing.json()['items']==[]
    before=dump()
    r=connected.post('/v1/admin/proofs',headers=staff(),json={'order_id':o['id'],'expected_proof_version':0,'proof_text':'Cannot invent configuration'})
    assert r.status_code==409
    assert dump()==before
    assert connected.get('/v1/orders/'+o['id'],headers=auth(o)).status_code==200

@pytest.mark.parametrize('value',[b'\xff','not-a-time','1234',None])
def test_history_timestamp_metadata_is_typed(connected,monkeypatch,value):
    o,p=prepared(connected,monkeypatch)
    with database() as db:
        # NULL cannot be stored in this NOT NULL column; use a JSON-looking string for the adjacent malformed case.
        db.execute('UPDATE proof_revision_evidence SET prepared_at=?',(value if value is not None else 'null',))
    assert history(connected,p).status_code==409


def test_history_legacy_capture_timestamp_is_typed(connected,monkeypatch):
    o,p=legacy(connected,monkeypatch);proof(connected,o,1)
    with database() as db:db.execute('UPDATE proof_legacy_observations SET captured_at=?',(b'\xff',))
    assert history(connected,p).status_code==409


def test_corrupt_private_payload_cannot_redirect_history(connected,monkeypatch):
    o,p=prepared(connected,monkeypatch)
    other=purchase(connected,cart(connected)).json();q=proof(connected,other)
    with database() as db:
        doc=load(db,p['id']);doc['id']=q['id'];doc['order_id']=other['id']
        db.execute('UPDATE records SET document=? WHERE id=?',(json.dumps(doc),p['id']))
    assert history(connected,p).status_code==409
    assert history(connected,p,1).status_code==409


def test_oversized_context_checked_before_json_parse(connected,monkeypatch):
    o,p=prepared(connected,monkeypatch)
    monkeypatch.setattr(evidence,'MAX_CONTEXT',16)
    calls=[];original=evidence.parsed
    def tracked(value):
        calls.append(value);return original(value)
    monkeypatch.setattr(evidence,'parsed',tracked)
    assert history(connected,p,1).status_code==409
    # Revision document parsed, context document was refused by SQL length metadata before fetch/parse.
    assert len(calls)==1 and 'proof_text' in calls[0]

@pytest.mark.parametrize('target',['schema','decision_schema','approved','current'])
def test_bool_is_not_revision_authority(connected,monkeypatch,target):
    o,p=prepared(connected,monkeypatch);assert decide(connected,p).status_code==200
    with database() as db:
        if target in ('schema','decision_schema'):
            table='proof_revision_evidence' if target=='schema' else 'proof_decision_evidence'
            raw=json.loads(db.execute('SELECT document FROM '+table).fetchone()[0]);raw['schema_version']=True
            db.execute('UPDATE '+table+' SET document=?',(json.dumps(raw),))
        else:
            doc=load(db,p['id'] if target=='approved' else o['id'])
            doc['approved_version' if target=='approved' else 'current_proof_version']=True;save(db,doc)
    assert decide(connected,p).status_code==409

@pytest.mark.parametrize('value',[True,None,'1',2])
def test_history_binding_schema_exact_or_absent(connected,monkeypatch,value):
    o,p=prepared(connected,monkeypatch)
    with database() as db:
        doc=load(db,p['id']);doc['binding_schema']=value;save(db,doc)
    assert history(connected,p).status_code==409
    assert history(connected,p,1).status_code==409
    assert connected.post('/v1/admin/proofs',headers=staff(),json={'order_id':o['id'],'expected_proof_version':1,'proof_text':'must not relabel corruption as legacy'}).status_code==409
