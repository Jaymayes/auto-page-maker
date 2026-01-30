#!/usr/bin/env python3
"""
Fleet Event Simulator - v3.5.1 Protocol Compliant
Emits NewUser, NewLead, PaymentSuccess with proper schema and Authorization
"""

import os
import json
import time
import uuid
import requests
from datetime import datetime

A8_URL = os.environ.get('A8_URL', 'https://auto-com-center-jamarrlmayes.replit.app/api/events')
A8_KEY = os.environ.get('A8_KEY', os.environ.get('S2S_API_KEY', ''))
APP_BASE_URL = 'https://auto-page-maker-jamarrlmayes.replit.app'

HEADERS = {
    'Content-Type': 'application/json',
    'x-scholar-protocol': 'v3.5.1',
    'x-app-label': 'auto_page_maker',
}

if A8_KEY:
    HEADERS['Authorization'] = f'Bearer {A8_KEY}'

def emit_event(event_type: str, context: dict, source_app: str = 'auto_page_maker') -> dict:
    """Emit a single event to A8 with v3.5.1 protocol"""
    event_id = f'{event_type}-{int(time.time())}-{uuid.uuid4().hex[:8]}'
    
    payload = {
        'event_type': event_type,
        'source_app_id': source_app,
        'app_base_url': APP_BASE_URL if source_app == 'auto_page_maker' else f'https://{source_app.replace("_", "-")}-jamarrlmayes.replit.app',
        'ts': int(time.time() * 1000),
        'context': context
    }
    
    headers = {**HEADERS, 'x-event-id': event_id, 'x-app-label': source_app}
    
    print(f'\n>>> Emitting {event_type} (ID: {event_id})')
    print(f'    Source: {source_app}')
    
    try:
        resp = requests.post(A8_URL, json=payload, headers=headers, timeout=10)
        result = resp.json()
        print(f'    Response: {json.dumps(result, indent=2)}')
        return {'event_id': event_id, 'response': result, 'status': resp.status_code}
    except Exception as e:
        print(f'    ERROR: {e}')
        return {'event_id': event_id, 'error': str(e), 'status': 0}

def main():
    print('=' * 60)
    print('Fleet Event Simulator - v3.5.1 Protocol')
    print('=' * 60)
    print(f'Target: {A8_URL}')
    print(f'Auth: {"Bearer token configured" if A8_KEY else "No auth token"}')
    print(f'Time: {datetime.utcnow().isoformat()}Z')
    
    results = []
    
    # Event 1: NewUser (simulating A1 scholar_auth)
    results.append(emit_event('NewUser', {
        'user_id_hash': 'sha256_canary_user_001',
        'signup_source': 'organic',
        'utm_source': 'auto_page_maker',
        'utm_campaign': 'canary_test'
    }, source_app='scholar_auth'))
    
    # Event 2: NewLead (simulating A7 auto_page_maker)
    results.append(emit_event('NewLead', {
        'lead_id': f'lead_{int(time.time())}',
        'page_slug': '/scholarships/nursing',
        'utm_source': 'google',
        'utm_medium': 'organic',
        'referrer': 'google.com'
    }, source_app='auto_page_maker'))
    
    # Event 3: PaymentSuccess (simulating A5 student_pilot)
    results.append(emit_event('PaymentSuccess', {
        'payment_id': f'pay_{int(time.time())}',
        'amount_cents': 100,
        'currency': 'usd',
        'mode': 'test',
        'user_id_hash': 'sha256_canary_user_001'
    }, source_app='student_pilot'))
    
    # Summary
    print('\n' + '=' * 60)
    print('SUMMARY')
    print('=' * 60)
    
    all_passed = True
    for r in results:
        status = '✅' if r.get('response', {}).get('persisted') else '❌'
        if not r.get('response', {}).get('persisted'):
            all_passed = False
        print(f"{status} {r['event_id']}: persisted={r.get('response', {}).get('persisted', False)}")
    
    print('\n' + '=' * 60)
    if all_passed:
        print('RESULT: ALL EVENTS PERSISTED - READY FOR DEMO MODE')
    else:
        print('RESULT: SOME EVENTS FAILED - CHECK A8 LOGS')
    print('=' * 60)
    
    return 0 if all_passed else 1

if __name__ == '__main__':
    exit(main())
