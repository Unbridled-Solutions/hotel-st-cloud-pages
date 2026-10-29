# MC lock — 29 Oct 2026

Fremont may iterate **this folder only**.

- Live shop tool is `/quote` (`fremont-makers-quote.html`, stamp **v1014t**). Do not edit it.
- GET `ns=fm-quotes` only. Never POST it. Never `wrangler kv key put` of `bundle:fm-quotes`.
- Do not retarget `/quote` or steal `/project-builder-2` in `src/index.js`.
- Do not `npx wrangler deploy` the dirty `hotel-st-cloud-pages` tree to ship a 2.0 tweak. Commit this folder only, then curl `/quote` and confirm `Project Builder v1014t`.
- “Delete from V2” = hide in the adapter. Not a KV wipe.

If the work needs the live builder, stop and send it to MC.
