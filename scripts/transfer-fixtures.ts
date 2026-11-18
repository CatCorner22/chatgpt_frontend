import { buildPack, packFiles, validatePack } from '../src/lib/exportPack';
import JSZip from 'jszip';
import { normalizeTokens } from '../src/lib/design';
import { GALLERY } from '../src/lib/gallery';
import { compile } from '@tailwindcss/node';
import { transform } from 'lightningcss';
const t=normalizeTokens({bg:'#ffffff',surface:'#f0f0f0',ink:'#121212',muted:'#555555',accent:'#166534',accentInk:'#ffffff',radius:8,headingFont:'Fraunces',bodyFont:'Manrope'});
// Exercise exactly the archive customers download, not just the in-memory builder.
const zip=await JSZip.loadAsync(await buildPack('# Vision',t,'Test',undefined,'existing'));
const files: Record<string,string>={};
for(const [name,entry] of Object.entries(zip.files)) {
 if(entry.dir) continue;
 if(!name.startsWith('focus-restyle/')) throw Error('Archive escaped its fresh folder');
 files[name.slice('focus-restyle/'.length)]=await entry.async('string');
}
await Bun.write('/tmp/browser/transfer/files.json',JSON.stringify({t,files}));
let count=0;
for (const g of GALLERY) for (const mode of ['new','existing'] as const) {
 const f=packFiles('# Vision',g.direction.tokens,g.direction.name,undefined,mode);
 if(validatePack(f,g.direction.tokens,mode).length) throw Error('Invalid pack');
 for(const [name,body] of Object.entries(f)) if(name.endsWith('.css') && name!=='tailwind-theme.css') {transform({filename:name,code:Buffer.from(body),errorRecovery:false});count++;}
}
const result=await compile('@import "tailwindcss"; @theme inline {--color-background: var(--background); --color-primary: var(--primary); --color-primary-foreground: var(--primary-foreground); --radius-lg:var(--radius);}',{base:process.cwd(),onDependency:()=>{}});
await Bun.write('/tmp/browser/transfer/tailwind.css',result.build(['bg-background','bg-primary','text-primary-foreground','rounded-lg']));
console.log('Parsed CSS files:',count,'Tailwind v4 fixture compiled');
const reactFixture = await Bun.build({entrypoints:['scripts/customer-project-fixture.tsx'],target:'browser',minify:false});
if (!reactFixture.success) throw Error('React customer fixture failed to bundle');
const artifact = reactFixture.outputs[0];
if (!artifact) throw Error('React customer fixture has no output');
await Bun.write('/tmp/browser/transfer/react-project.js', await artifact.text());
