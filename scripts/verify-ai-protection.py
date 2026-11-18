"""No provider calls: verify shared throttle and signed-in paused UI safely."""
import os, uuid, secrets, requests, asyncio
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from playwright.async_api import async_playwright
base=os.environ['SUPABASE_URL']; admin=os.environ['SUPABASE_SERVICE_ROLE_KEY']; key=os.environ['SUPABASE_PUBLISHABLE_KEY']
D=Path('/tmp/browser/ai-protection'); D.mkdir(parents=True,exist_ok=True)
def call(path, body=None, token=None, privileged=False, method='POST'):
    h={'apikey':admin if privileged else key,'Content-Type':'application/json'}
    if privileged or token: h['Authorization']='Bearer '+(admin if privileged else token)
    return requests.request(method,base+path,json=body,headers=h,timeout=30)
users=[]
try:
    email='focus-throttle-'+uuid.uuid4().hex+'@example.test'; password=secrets.token_urlsafe(24)
    r=call('/auth/v1/admin/users',{'email':email,'password':password,'email_confirm':True},privileged=True); assert r.ok
    user=r.json()['id']; users.append(user)
    r=call('/auth/v1/token?grant_type=password',{'email':email,'password':password}); assert r.ok
    token=r.json()['access_token']
    reserve=lambda: call('/rest/v1/rpc/reserve_ai_request',{'_user_id':user},privileged=True)
    release=lambda ticket: call('/rest/v1/rpc/release_ai_request',{'_user_id':user,'_ticket':ticket},privileged=True)
    for t in [None,token]:
        assert not call('/rest/v1/rpc/reserve_ai_request',{'_user_id':user},token=t).ok
    with ThreadPoolExecutor(max_workers=8) as pool: results=list(pool.map(lambda _:reserve(),range(8)))
    successes=[r for r in results if r.ok]; assert len(successes)==1,'concurrent requests both admitted'
    ticket=successes[0].json()
    assert release(str(uuid.uuid4())).ok
    assert not reserve().ok,'wrong ticket released reservation'
    assert release(ticket).ok
    for _ in range(5):
        r=reserve(); assert r.ok; assert release(r.json()).ok
    assert not reserve().ok,'seventh start in rolling minute admitted'
    async def ui():
        async with async_playwright() as p:
            browser=await p.chromium.launch(headless=True)
            page=await browser.new_page(viewport={'width':1280,'height':1800})
            await page.goto('http://localhost:8080/auth')
            # Use the actual app sign-in form, no provider requests.
            await page.get_by_label('Email',exact=True).fill(email)
            await page.get_by_label('Password',exact=True).fill(password)
            await page.get_by_role('button',name='Sign in',exact=True).click()
            await page.wait_for_url('**/projects')
            await page.goto('http://localhost:8080')
            await page.get_by_role('status').filter(has_text='Paid AI is paused').wait_for()
            # Generated RPC stub (not a guessed HTTP endpoint).
            result=await page.evaluate("""async () => {
              const {proposeDirections}=await import('/src/lib/design.functions.ts');
              try { await proposeDirections({data:{brief:'A booking app for local studios',purpose:'Simple scheduling'}}); return 'unexpected success'; }
              catch(e) { return e.message; }
            }""")
            assert 'paused until launch' in result,result
            for width in [1280,390]:
                await page.set_viewport_size({'width':width,'height':1800})
                await page.goto('http://localhost:8080')
                await page.get_by_label('Your brief',exact=True).fill('A booking app for local studios')
                await page.get_by_role('button',name='Show me three directions',exact=True).click()
                await page.get_by_role('alert').filter(has_text='paused until launch').wait_for()
                await page.screenshot(path=str(D/f'directions-{width}.png'))
                await page.goto('http://localhost:8080/taste')
                await page.get_by_label('What do you love?',exact=True).fill('Botanical prints and clean architecture')
                await page.get_by_role('button',name='Create my portrait',exact=True).click()
                await page.get_by_role('alert').filter(has_text='paused until launch').wait_for()
                await page.screenshot(path=str(D/f'portrait-{width}.png'))
                await page.goto('http://localhost:8080/critic')
                await page.get_by_label('Screenshot file',exact=True).set_input_files('/tmp/browser/ai-protection/fixture.png')
                await page.get_by_role('alert').filter(has_text='paused until launch').wait_for()
                await page.get_by_role('button',name='Try again',exact=True).click()
                await page.get_by_role('alert').filter(has_text='paused until launch').wait_for()
                await page.screenshot(path=str(D/f'screenshot-{width}.png'))
                await page.get_by_label('Website address',exact=True).fill('https://example.com')
                await page.get_by_role('button',name='Check this page',exact=True).click()
                await page.get_by_text('Quality score',exact=True).wait_for(timeout=60000)
                await page.get_by_text('Open a saved Vision in this browser to compare its design values.',exact=True).wait_for()
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                await page.screenshot(path=str(D/f'measured-check-{width}.png'))
            result=await page.evaluate("""async () => {
              const {proposeStep}=await import('/src/lib/design.functions.ts');
              try { await proposeStep({data:{brief:'A booking app for local studios',purpose:'Scheduling',stepId:'palette',tokens:{},history:''}});return 'unexpected success'; }
              catch(e){return e.message;}
            }""")
            assert 'paused until launch' in result,result
            await page.screenshot(path=str(D/'paused-desktop.png'))
            await page.set_viewport_size({'width':390,'height':1800})
            assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await page.screenshot(path=str(D/'paused-phone.png'))
            await browser.close()
    from PIL import Image
    Image.new('RGB',(400,300),'white').save(D/'fixture.png')
    asyncio.run(ui())
    print('PASS: signed-in AI refused before provider call; anonymous/customer counter access denied; one concurrent reservation; six rolling-minute starts; wrong-ticket release denied; visible desktop/phone pause alert.')
finally:
    for user in users:
        call('/rest/v1/ai_request_guards?user_id=eq.'+user,privileged=True,method='DELETE')
        call('/auth/v1/admin/users/'+user,privileged=True,method='DELETE')