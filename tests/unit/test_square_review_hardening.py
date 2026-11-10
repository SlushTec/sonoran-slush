"""Offline follow-up to independent Square review; never calls provider services."""
import io
import json
from email.message import Message
import urllib.request
import urllib.error

import pytest
from fastapi import HTTPException
from services.commerce.app import payments
from services.commerce.app.workflows import database, load
from test_commerce_workflows import connected, order, session, payment_event, send_event, auth


@pytest.mark.parametrize('url',[
    'https://sandbox.square.link/u/fTkKKauH',
    'https://sandbox.square.link/u/J1lWcEhY',
    'https://sandbox.square.link:443/u/fTkKKauH',
])
def test_documented_sandbox_checkout_response(connected,monkeypatch,url):
    class Response:
        def __enter__(self): return self
        def __exit__(self,*args): pass
        def read(self,limit):
            assert limit==65536
            return json.dumps({'payment_link':{'id':'UO6BJB7EXQOQKIDA','version':1,'order_id':'0mKB0CULaS8SYRAJXaoIp1SUABZZY','url':url}}).encode()
    def open_mock(request,timeout):
        assert request.full_url=='https://connect.squareupsandbox.com/v2/online-checkout/payment-links'
        assert timeout==12
        return Response()
    def opener(*handlers):
        assert any(isinstance(h,payments.RefuseRedirects) for h in handlers)
        return type('MockOpener',(),{'open':staticmethod(open_mock)})()
    monkeypatch.setattr(payments.urllib.request,'build_opener',opener)
    assert payments.square_checkout({'idempotency_key':'synthetic-test'})['url']==url


@pytest.mark.parametrize('url',[
    'http://sandbox.square.link/u/fTkKKauH',
    'https://square.link/u/fTkKKauH',
    'https://checkout.square.site/fTkKKauH',
    'https://connect.squareupsandbox.com/u/fTkKKauH',
    'https://sandbox.square.link.evil.example/u/fTkKKauH',
    'https://user@sandbox.square.link/u/fTkKKauH',
    'https://sandbox.square.link@evil.example/u/fTkKKauH',
    'https://sandbox.square.link:444/u/fTkKKauH',
    'https://sandbox.square.link:0443/u/fTkKKauH',
    'https://sandbox.square.link./u/fTkKKauH',
    'https://sandbox.square.link/u/',
    'https://sandbox.square.link/checkout/fTkKKauH',
    'https://sandbox.square.link/u/fTkKKauH/extra',
    'https://sandbox.square.link/u/../fTkKKauH',
    'https://sandbox.square.link/u/%2ffTkKKauH',
    'https://sandbox.square.link/u/fTkKKauH?next=https://evil.example',
    'https://sandbox.square.link/u/fTkKKauH#fragment',
    'https://sandbox.square.link/u/fTkKKauH\n',
    '\thttps://sandbox.square.link/u/fTkKKauH',
    None,
])
def test_checkout_url_is_strict(url):
    assert not payments.sandbox_checkout_url(url)


@pytest.mark.parametrize('status',[301,302,303,307,308])
@pytest.mark.parametrize('target',['https://evil.example/collect','https://connect.squareupsandbox.com/redirect'])
def test_redirect_refused_before_second_request(connected,monkeypatch,status,target):
    # Use real urllib opener/redirect machinery with an in-memory HTTPS handler.
    # There are no sockets, credential reads or provider calls in this fake transport.
    calls=[]
    class MockHTTPS(urllib.request.HTTPSHandler):
        def https_open(self,request):
            calls.append(request.full_url)
            headers=Message();headers['Location']=target
            response=urllib.response.addinfourl(io.BytesIO(b''),headers,request.full_url,status)
            response.msg='Redirect'
            return response
    real_builder=urllib.request.build_opener
    monkeypatch.setattr(payments.urllib.request,'build_opener',lambda *handlers:real_builder(*handlers,MockHTTPS()))
    with pytest.raises(HTTPException) as error:
        payments.square_checkout({'idempotency_key':'synthetic-test'})
    assert error.value.status_code==502
    assert calls==['https://connect.squareupsandbox.com/v2/online-checkout/payment-links']


@pytest.mark.parametrize('amount',[1,12345])
@pytest.mark.parametrize('previously_paid',[False,True])
def test_signed_refunds_require_durable_reconciliation(connected,monkeypatch,amount,previously_paid):
    o=order(connected);session(connected,o,monkeypatch)
    paid=payment_event(o['id'],event_id='original-paid')
    if previously_paid: assert send_event(connected,paid).json()['applied'] is True
    refunded=payment_event(o['id'],event_id='refund-update')
    refunded['data']['object']['payment']['refunded_money']={'amount':amount,'currency':'USD'}
    result=send_event(connected,refunded)
    assert result.status_code==200,result.text
    assert result.json()['reconciliation_required'] is True
    assert send_event(connected,refunded).json()['applied'] is False
    with database() as db:
        doc=load(db,o['id']);assert doc['payment_status']=='reconciliation_required'
        assert doc['status']=='payment_reconciliation_required'
        assert doc['refunded_minor']==amount
    # Neither an old retry nor a new no-refund event may clear the reconciliation hold.
    result=send_event(connected,paid)
    assert result.status_code==(200 if previously_paid else 409)
    assert send_event(connected,payment_event(o['id'],event_id='late-paid')).status_code==409
    with database() as db: assert load(db,o['id'])['payment_status']=='reconciliation_required'
    assert connected.get('/ready').status_code==503


def test_explicit_zero_refund_can_be_paid(connected,monkeypatch):
    o=order(connected);session(connected,o,monkeypatch)
    payload=payment_event(o['id']);payload['data']['object']['payment']['refunded_money']={'amount':0,'currency':'USD'}
    assert send_event(connected,payload).json()['applied'] is True


@pytest.mark.parametrize('refund',[{'amount':True,'currency':'USD'},{'amount':-1,'currency':'USD'},{'amount':'1','currency':'USD'},{'amount':1,'currency':'EUR'},{}])
def test_invalid_refund_data_does_not_pay(connected,monkeypatch,refund):
    o=order(connected);session(connected,o,monkeypatch)
    payload=payment_event(o['id']);payload['data']['object']['payment']['refunded_money']=refund
    assert send_event(connected,payload).status_code==400
    with database() as db: assert load(db,o['id'])['payment_status']=='unpaid'


def test_stored_legacy_checkout_url_requires_reconciliation(connected,monkeypatch):
    o=order(connected);session(connected,o,monkeypatch)
    with database() as db:
        db.execute("UPDATE square_sessions SET url=?",('https://connect.squareupsandbox.com/old-link',))
    monkeypatch.setattr(payments,'square_checkout',lambda fields:pytest.fail('must not call provider'))
    result=connected.post('/v1/checkout/sessions',json={'order_id':o['id'],'version':1},headers=auth(o))
    assert result.status_code==409


def test_out_of_order_refund_totals_cannot_reduce_durable_hold(connected,monkeypatch):
    o=order(connected);session(connected,o,monkeypatch)
    for amount in (12345,1):
        payload=payment_event(o['id'],event_id='refund-'+str(amount))
        payload['data']['object']['payment']['refunded_money']={'amount':amount,'currency':'USD'}
        assert send_event(connected,payload).json()['reconciliation_required'] is True
    with database() as db:
        doc=load(db,o['id'])
        assert doc['refunded_minor']==12345
        assert doc['payment_status']=='reconciliation_required'
