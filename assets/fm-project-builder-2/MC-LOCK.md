# MC lock — 5 Nov 2026

Fremont may iterate **this folder only**.

- Live shop tool is `/projectbuilder` (this folder, pack **v2.10.0**). Writes `ns=fm-phase1` only.
- Old builder `/quote` (`fremont-makers-quote.html`, stamp **v1105a**) stays live as lookup / DNU. Do not edit it. Do not redirect it.
- GET `ns=fm-quotes` only from 2.0. Never POST it. Never `wrangler kv key put` of `bundle:fm-quotes`.
- Do not retarget `/quote` in `src/index.js`. Canonical new route is `/projectbuilder`.
- Do not `npx wrangler deploy` the dirty `hotel-st-cloud-pages` tree to ship a 2.0 tweak. Commit this folder (plus the `/projectbuilder` Worker map if needed), then curl `/quote` and confirm `Project Builder v1105a`.
- “Delete from V2” = hide in the adapter / FMLegacy skipped list. Not a KV wipe.

If the work needs the old `/quote` files, stop and send it to MC.
