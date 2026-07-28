---
title: 'Token Splitting Revisited (Draft)'
date: 2026-07-27
draft: true
tags: [type:jailbreak, type:obfuscation, model:gpt-4o]
---

Rough. Renders under `astro dev`, excluded from the production build.

The idea: modern tokenizers merge more aggressively than the 2023 ones, so the
classic `w o r d` splitting no longer reliably lands on separate tokens. Need to
recheck which separators still force a split boundary on current BPE vocabs.

DRAFT_CANARY_9b2e marks this note for the build verifier.
