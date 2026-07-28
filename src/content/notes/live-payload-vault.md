---
title: 'Live Payload Vault (PRIVATE)'
date: 2026-07-25
visibility: private
tags: [type:jailbreak, comp:gsa, unpublished]
---

This note carries a working, unpublished payload and must never reach `dist/`
or the Pagefind index. Its slug — `live-payload-vault` — is asserted absent from
the build by `scripts/verify-build.mjs`. If you can read this on the live site,
the private-visibility filter has failed and that is a shipping blocker.

The string PRIVATE_CANARY_7f3a exists so the verifier has something unambiguous
to grep for.
