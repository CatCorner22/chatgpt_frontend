import os,json,uuid,secrets,requests
from pathlib import Path
base=os.environ['SUPABASE_URL']; admin=os.environ['SUPABASE_SERVICE_ROLE_KEY']; key=os.environ['SUPABASE_PUBLISHABLE_KEY']; D=Path('/tmp/browser/transfer'); users=[]; rows=[]; logs=[]
def call(path,method='GET',body=None,token=None,priv=False):
 h={'apikey':admin if priv else key,'Content-Type':'application/json','Prefer':'return=representation'}
 if priv:h['Authorization']='Bearer '+admin
 elif token:h['Authorization']='Bearer '+token
 return requests.request(method,base+path,headers=h,json=body,timeout=30)
try:
 sessions=[]
 for label in ['A','B']:
  email='focus-audit-'+uuid.uuid4().hex[:10]+'@example.test';password=secrets.token_urlsafe(24)
  r=call('/auth/v1/admin/users','POST',{'email':email,'password':password,'email_confirm':True,'user_metadata':{'name':'Transfer test '+label}},priv=True);assert r.ok, r.status_code;u=r.json();users.append(u['id'])
  r=call('/auth/v1/token?grant_type=password','POST',{'email':email,'password':password});assert r.ok,r.status_code;sessions.append(r.json())
 a,b=users; ta,tb=[s['access_token'] for s in sessions]
 specimens={'projects':{'title':'audit','state':{}},'shares':{'title':'audit','snapshot':{}},'brand_builds':{'build_id':str(uuid.uuid4()),'state':{}},'design_progress':{'design_id':str(uuid.uuid4()),'title':'audit','fingerprint':'audit'},'watched_sites':{'url':'https://example.com','enabled':False},'vision_links':{'design_id':'f-1234567890','vision':'audit live Vision long enough'},'vision_events':{'design_id':'f-1234567890'},'badges':{'url':'https://example.com','design_id':'f-1234567890','tokens':{},'passing':False,'next_check':'2099-01-01T00:00:00Z'}}
 for table,data in specimens.items():
  r=call('/rest/v1/'+table,'POST',{**data,'user_id':b},priv=True);assert r.ok,(table,r.status_code);row=r.json()[0];rows.append((table,row.get('id'),row.get('build_id')))
  query='id=eq.'+row['id'] if row.get('id') else 'build_id=eq.'+row['build_id']
  for token in [ta,None]:
   r=call('/rest/v1/'+table+'?'+query,token=token);assert not r.ok or r.json()==[],(table,'read leak')
  r=call('/rest/v1/'+table+'?'+query,'PATCH',{'user_id':a},token=ta);assert not r.ok or r.json()==[],(table,'update leak')
  r=call('/rest/v1/'+table+'?'+query,'DELETE',token=ta);assert not r.ok or r.json()==[],(table,'delete leak')
  r=call('/rest/v1/'+table+'?'+query,priv=True);assert r.ok and len(r.json())==1,(table,'row lost')
  logs.append(table+': A/anonymous private reads blocked; A cross-owner changes/deletes blocked PASS')
 # profiles auto-created; roles no privileged test grants needed
 for table,idfield in [('profiles','id'),('user_roles','user_id')]:
  r=call('/rest/v1/'+table+'?'+idfield+'=eq.'+b,token=ta);assert not r.ok or r.json()==[]
  r=call('/rest/v1/'+table+'?'+idfield+'=eq.'+b,token=None);assert not r.ok or r.json()==[]
  logs.append(table+': cross-user and anonymous reads blocked PASS')
 r=call('/rest/v1/user_roles','POST',{'user_id':a,'role':'admin'},token=ta);assert not r.ok
 r=call('/rest/v1/rpc/owner_counts','POST',{},token=ta);assert not r.ok
 r=call('/rest/v1/rpc/has_role','POST',{'_user_id':b,'_role':'admin'},token=ta);assert r.ok and r.json()==False
 r=call('/rest/v1/rpc/has_role','POST',{'_user_id':b,'_role':'admin'});assert not r.ok
 logs.append('Role escalation, owner counts and other-user role probes blocked PASS')
 r=call('/rest/v1/badges','POST',{'user_id':a,'url':'https://example.com','design_id':'f-1234567890','tokens':{},'passing':True,'score':100},token=ta);assert not r.ok
 badge=next(x for x in rows if x[0]=='badges')[1]
 r=call('/rest/v1/badges?id=eq.'+badge,'PATCH',{'passing':True,'score':100},token=tb);assert not r.ok
 r=call('/rest/v1/badges?id=eq.'+badge,'PATCH',{'showcase':True},token=tb);assert r.ok
 logs.append('Direct fake-badge insert/update blocked; owner showcase update retained PASS')
 vision=call('/rest/v1/vision_links?user_id=eq.'+b,priv=True).json()[0];token=vision['token']
 r=call('/rest/v1/rpc/get_vision','POST',{'_token':token});assert r.ok and len(r.json())==1
 call('/rest/v1/vision_links?id=eq.'+vision['id'],'PATCH',{'enabled':False},token=tb)
 r=call('/rest/v1/rpc/get_vision','POST',{'_token':token});assert r.ok and r.json()==[]
 logs.append('Live Vision bearer read then revocation blocks read PASS')
 print('\n'.join(logs));(D/'isolation-results.txt').write_text('\n'.join(logs))
finally:
 for table,id_,build in rows:
  q='id=eq.'+id_ if id_ else 'build_id=eq.'+build
  call('/rest/v1/'+table+'?'+q,'DELETE',priv=True)
 # Remove only disposable users created by this run.
 for u in users:call('/auth/v1/admin/users/'+u,'DELETE',priv=True)

