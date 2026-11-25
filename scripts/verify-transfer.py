import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
D=Path('/tmp/browser/transfer'); payload=json.loads((D/'files.json').read_text()); files=payload['files']
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True, executable_path=os.getenv("CHROMIUM_PATH"))
  results=[]
  for w in [1280,768,390]:
   for kind in ['plain','tailwind4','legacy','fixed','portal','module','shadow','react19','react19-tailwind4']:
    page=await browser.new_page(viewport={'width':w,'height':1800})
    base=':root{--background:#ddeeff;--primary:#991122;--primary-foreground:#ffffff;--radius:4px} body{background:#ddeeff;color:#222;font-family:Arial} h1{font-family:Arial} button{min-height:44px} main{padding:20px} .sample{background:var(--primary);color:var(--primary-foreground);border-radius:var(--radius)}'
    if kind=='legacy':base=base.replace('--background:#ddeeff','--background:210 50% 80%').replace('--primary:#991122','--primary:352 80% 35%').replace('--primary-foreground:#ffffff','--primary-foreground:0 0% 100%')+' .sample{background:hsl(var(--primary));color:hsl(var(--primary-foreground))}'
    if kind in ['tailwind4','react19-tailwind4']:base+=(D/'tailwind.css').read_text()
    if kind=='fixed':base+=' .sample{background:#991122}'
    if kind=='module':base+=' .sample{background:var(--primary)}'
    html=f'''<!doctype html><html lang="en"><head><style>{base}</style></head><body><aside id="outside">Outside page</aside><main><h1>Customer booking</h1><a href="#details">Details</a><form><label>Email<input name="email" type="email" required></label><button class="sample bg-primary text-primary-foreground rounded-lg">Book</button></form><p role="status"></p><button id="increment">Add item</button><output>0</output><section id="details">Original words</section></main><div id="portal">Existing portal</div><script>document.querySelector('form').onsubmit=e=>{{e.preventDefault();document.querySelector('[role=status]').textContent='Booked '+document.querySelector('input').value}};document.querySelector('#increment').onclick=()=>document.querySelector('output').textContent=Number(document.querySelector('output').textContent)+1</script></body></html>'''
    await page.set_content(html)
    if kind.startswith('react19'):
     await page.locator('main').evaluate("e=>{const root=document.createElement('div');root.id='customer-root';e.replaceWith(root)}")
     await page.add_script_tag(content=(D/'react-project.js').read_text())
     await page.get_by_role('heading',name='Customer booking').wait_for()
    if kind=='shadow':
     await page.locator('#portal').evaluate("e=>{const r=e.attachShadow({mode:'open'});r.innerHTML='<style>button{background:#991122;color:#fff}</style><button>Shadow action</button><output>0</output>';r.querySelector('button').onclick=()=>r.querySelector('output').textContent=String(Number(r.querySelector('output').textContent)+1)}")
    async def inventory():
     return await page.evaluate("""() => [...document.querySelectorAll('a,form,input,button')].map(e =>
       [e.tagName,e.getAttribute('href'),e.getAttribute('action'),e.getAttribute('name'),e.getAttribute('type'),e.textContent])""")
    async def appearance():
     return await page.evaluate("""() => Object.fromEntries(['body','main','h1','.sample','#outside','#portal'].map(selector => {
       const s = getComputedStyle(document.querySelector(selector));
       return [selector, [s.backgroundColor, s.color, s.fontFamily, s.borderRadius]];
     }))""")
    controls=await inventory()
    before=await appearance()
    async def task():
     await page.get_by_role('textbox',name='Email').fill('visitor@example.test');await page.get_by_role('button',name='Book',exact=True).click();assert await page.locator('p[role=status]').inner_text()=='Booked visitor@example.test'
     await page.get_by_role('button',name='Add item').click();await page.get_by_role('link',name='Details',exact=True).click()
     if kind=='shadow':await page.get_by_role('button',name='Shadow action').click()
    await task()
    tokens=await page.add_style_tag(content=files['focus-tokens.css'])
    bridge=await page.add_style_tag(content=files['focus-bridge-legacy.css' if kind=='legacy' else 'focus-bridge.css'])
    assert await appearance()==before,'install repainted customer'
    wrapper=page.locator('main')
    await wrapper.evaluate("e=>e.setAttribute('data-focus-restyle','')")
    assert await appearance()==before,'exposing namespaced values repainted customer'
    if kind!='fixed':
     await wrapper.evaluate("e=>e.setAttribute('data-focus-theme','semantic')")
    after=await appearance()
    for selector in ['body','main','h1','#outside','#portal']:
     assert after[selector]==before[selector], (kind,w,selector,'unexpected style change')
    if kind=='fixed':
     assert after['.sample']==before['.sample'],'fixed-color control changed'
    else:
     assert after['.sample'][:2]==['rgb(22, 101, 52)','rgb(255, 255, 255)'], (kind,w,after['.sample'])
    await task();assert await page.locator('main output').inner_text()=='2'
    assert await inventory()==controls,'customer markup changed'
    if kind=='shadow':assert await page.locator('#portal button').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(153, 17, 34)','shadow component unexpectedly repainted'
    await page.screenshot(path=str(D/f'{kind}-{w}-after.png'))
    await wrapper.evaluate("e=>e.removeAttribute('data-focus-theme')")
    assert await appearance()==before,'disabling semantic mapping did not restore customer styles'
    await wrapper.evaluate("e=>e.removeAttribute('data-focus-restyle')")
    assert await appearance()==before,'rollback differs';await task();assert await page.locator('main output').inner_text()=='3'
    for sheet in [tokens,bridge]:
     await sheet.evaluate('e=>e.remove()')
    assert await appearance()==before,'import removal differs'
    if kind=='shadow':assert await page.locator('#portal output').inner_text()=='3'
    if kind.startswith('react19'):assert await page.locator('[data-route]').inner_text()=='Details','React navigation state lost'
    await page.screenshot(path=str(D/f'{kind}-{w}-undo.png'));results.append(f'{kind} {w}: inert install, scoped styles, form/link/button preserved, exact CSS rollback PASS');await page.close()
  (D/'results.txt').write_text('\n'.join(results));print('\n'.join(results));await browser.close()
asyncio.run(main())
