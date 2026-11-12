"""Actual Starlette request streams, synthetic events; no provider connections."""
import asyncio
import base64
from hashlib import sha256
import hmac
import json
import pytest
from fastapi import HTTPException
from starlette.requests import Request, ClientDisconnect
from services.commerce.app import payments

KEY='fictional-webhook-key'
URL='https://example.invalid/webhook'

@pytest.fixture(autouse=True)
def configuration(monkeypatch):
    monkeypatch.setenv('SQUARE_SANDBOX_WEBHOOK_KEY',KEY)
    monkeypatch.setenv('SQUARE_WEBHOOK_NOTIFICATION_URL',URL)
    monkeypatch.setenv('SQUARE_SANDBOX_MERCHANT_ID','fictional-merchant')
    def no_db(): raise AssertionError('No database expected')
    monkeypatch.setattr(payments,'database',no_db)


def request(chunks,headers=()):
    calls=[]
    async def receive():
        i=len(calls);calls.append(i)
        if i>=len(chunks): raise AssertionError('Stream read beyond last chunk')
        return {'type':'http.request','body':chunks[i],'more_body':i<len(chunks)-1}
    return Request({'type':'http','method':'POST','path':'/','headers':list(headers)},receive),calls


def signature(raw):
    return base64.b64encode(hmac.new(KEY.encode(),URL.encode()+raw,sha256).digest()).decode()


def invoke(req,sig=''):
    return asyncio.run(payments.payment_webhook(req,sig))


@pytest.mark.parametrize('chunks,reads',[
    ([b'x'*65537],1),([b'x'*65536,b'x',b'never-read'],2),
    ([b'x'*32768,b'x'*32769,b'never-read'],2),([b'x'*1048576,b'never-read'],1)])
@pytest.mark.parametrize('headers',[[],[(b'content-length',b'1')],[(b'content-length',b'999999999')]])
def test_overflow_stops_before_signature_or_db(monkeypatch,chunks,reads,headers):
    def no_verify(*args): raise AssertionError('Oversized body reached signature verifier')
    monkeypatch.setattr(payments,'verify_signature',no_verify)
    req,calls=request(chunks,headers)
    with pytest.raises(HTTPException) as exc:invoke(req)
    assert exc.value.status_code==413
    assert len(calls)==reads and not hasattr(req,'_body')


@pytest.mark.parametrize('size',[0,1,65535,65536])
def test_limit_preserves_exact_bytes(monkeypatch,size):
    raw=b'x'*size;seen=[]
    def verify(body,*args):
        seen.append(body)
        return {'merchant_id':'fictional-merchant','type':'ignored'}
    monkeypatch.setattr(payments,'verify_signature',verify)
    req,_=request([raw[:size//2],b'',raw[size//2:]])
    assert invoke(req)=={'received':True,'applied':False}
    assert seen==[raw]


@pytest.mark.parametrize('step',[1,2,7,101])
def test_real_hmac_unicode_split_boundaries(step):
    raw=json.dumps({'event_id':'synthetic','merchant_id':'fictional-merchant',
                   'type':'ignored','text':'Éclair 雪'},ensure_ascii=False).encode()
    req,_=request([raw[i:i+step] for i in range(0,len(raw),step)])
    assert invoke(req,signature(raw))=={'received':True,'applied':False}


@pytest.mark.parametrize('raw',[b'',b'{',b'[]',b'null'])
def test_signed_invalid_json_still_rejected(raw):
    req,_=request([raw])
    with pytest.raises(HTTPException) as exc:invoke(req,signature(raw))
    assert exc.value.status_code==400


def test_disconnect_does_not_verify_partial_body(monkeypatch):
    def no_verify(*args): raise AssertionError('Partial body must not verify')
    monkeypatch.setattr(payments,'verify_signature',no_verify)
    async def receive(): return {'type':'http.disconnect'}
    req=Request({'type':'http','method':'POST','path':'/','headers':[]},receive)
    with pytest.raises(ClientDisconnect):invoke(req)
