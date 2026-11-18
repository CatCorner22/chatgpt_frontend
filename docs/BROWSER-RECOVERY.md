# Reference capture recovery

Needed: inspect Audi.com and Firehouse.com layout at desktop/mobile.
Block: cloud CUA returns `the gaas-browser node_repl sandbox cannot be disabled` before opening a page (tooling/environment). Browser plugin control is absent from discovered tools.
Routes considered: (1) web connector for source text; (2) isolated local Chromium for public visual capture; (3) direct public HTML/CSS for layout evidence; (4) search-index images as secondary visual evidence; (5) complete attachment comparison and defer visual changes if valid rendering remains unavailable.
Attempt 1: web connector returned both public pages and their navigation/content structures.
Next: isolated local Chromium, without an existing profile or sign-in session; this does not bypass a site access restriction.
Attempt 2: isolated Chromium captured both public pages at 1440px and390px. Page images loaded, with lazy/consent overlays still visible; limits recorded in REFERENCE-OBSERVATIONS.md. No site access control was encountered or bypassed.
