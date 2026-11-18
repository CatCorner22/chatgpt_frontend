// A typical generic AI landing page, written to represent common patterns (not copied from any real site).
export const GENERIC_AI_PAGE = `<!doctype html><html><head><title>NovaFlow</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700" rel="stylesheet">
<style>body{font-family:Inter,sans-serif;color:#6b7280;background:#ffffff}
.hero{background:linear-gradient(135deg,#7c3aed,#3b82f6);padding:80px;text-align:center}
h1{font-size:56px;color:#fff}.card{border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.1)}
.a{font-size:13px}.b{font-size:15px}.c{font-size:17px}.d{font-size:19px}.e{font-size:21px}.f{font-size:23px}.g{font-size:27px}.h{font-size:31px}.i{font-size:35px}.j{font-size:42px}.k{font-size:48px}
</style></head><body>
<div class="hero"><h1>Unlock Your Potential</h1><p>Elevate your workflow with our seamless, cutting-edge platform that empowers teams to supercharge productivity.</p>
<a href="#">Get Started</a> <a href="#">Learn More</a></div>
<h1>Why NovaFlow?</h1><img src="blob1.png"><img src="blob2.png"><img src="blob3.png">
<h4>Fast</h4><p>Lightning fast.</p><h4>Secure</h4><p>Bank-grade security.</p><h4>Simple</h4><p>Easy to use.</p>
<p>"This changed everything!" — Sarah K.</p><a href="#">Learn More</a></body></html>`;

// Wraps the studio's rendered preview in a minimal document, as a builder following the Vision would ship it.
export function wrapPreview(inner: string, title: string, fonts: string[]) {
  const links = fonts.map((f) => `<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, "+")}" rel="stylesheet">`).join("");
  return `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>${links}</head><body>${inner}</body></html>`;
}
