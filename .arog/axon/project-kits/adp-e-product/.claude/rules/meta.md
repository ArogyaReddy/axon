---
paths: ["meta/**"]
---

# Meta (adp-e-product)

- Never hand-edit `meta/build/` or `meta/build-metasync/` (generated; protected by axon).
- After changing `meta/src/`, rebuild before pushing: `make meta && npm run load-meta -- FIT`. A stale build gives a
  silent `C_AUTH_ERROR` in STG (IFX-002). `load-meta` needs `AWS_PROFILE=FIT` (run `awslogin`) and a `feature/` branch.
- Checked by `check-meta-fresh` (run by `axon-verify`).
