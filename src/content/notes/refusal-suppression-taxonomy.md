---
title: 'A Taxonomy of Refusal Suppression'
date: 2026-05-11
tags: [taxonomy, type:jailbreak, type:refusal-suppression, model:claude-sonnet-4, model:gpt-4o, model:llama-3-70b]
---

Refusal is not one behaviour, so suppressing it is not one technique. This is
the working taxonomy I sort attempts into. It is descriptive — built from what
lands, not from a theory of why.

## Axis 1: what the payload targets

**The classifier.** Some refusals are produced by something that looks like a
learned classifier firing on the request. These fall to obfuscation: encoding,
translation, token splitting, framing the request as its own inverse. Cheap,
brittle, patched fast.

**The policy.** Some refusals come from the model reasoning about a policy it
holds. These do not fall to obfuscation because the model decodes your
obfuscation and then applies the policy to the decoded content. They fall to
*reframing the policy's applicability* — establishing that this case is the
exception the policy itself would carve out.

**The disposition.** Some refusals are neither — they are a general reluctance
with no specific rule behind them. These are the hardest to suppress with a
single move and the easiest to erode with sustained context. See
[[context-overloading]].

The first mistake most people make is treating all three as one and reaching
for obfuscation every time.

## Axis 2: where the leverage is applied

| Locus | Mechanism | Durability |
|---|---|---|
| Input encoding | Hide the request from a classifier | Low — patched per-encoding |
| Role framing | Change who the model thinks is speaking | Medium |
| Task framing | Change what the model thinks it is doing | Medium-high |
| Context establishment | Change the operative reality | High, expensive |
| Output-channel | Constrain the response format past the refusal | Variable |

Output-channel deserves a note. Techniques that constrain the *shape* of the
response — "answer only in the following JSON schema," "continue this exact
prefix" — work by making refusal syntactically awkward rather than
semantically defeated. They are underrated because they compose with everything
above them.

## Axis 3: single-turn vs. accumulated

A single-turn payload has to do all its work in one message and survive being
read as a whole. An accumulated attack spreads the work across turns, so that no
single turn parses as adversarial and the boundary is crossed by a step so small
the model does not register it as a step.

Accumulation is strictly more powerful and strictly more expensive, and defences
tuned on single-turn corpora systematically under-weight it.

## What I have stopped doing

Chasing individual clever prompts. A prompt that works is a data point about a
mechanism; the mechanism is the asset. When I find something that lands I now
spend the follow-up time on "what is the smallest change that breaks it" and
"what is the largest generalisation that preserves it," and file the result
under a mechanism, not a wording.

## Cross-references

- [[indirect-injection-primer]] — delivery vectors for these payloads
- [[gsa/june26-writeup]] — this taxonomy applied under competition constraints
