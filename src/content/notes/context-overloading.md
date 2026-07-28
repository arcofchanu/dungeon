---
title: 'Context Overloading in Indirect Injection'
date: 2026-07-28
tags: [comp:gsa, type:indirect-injection, type:context-manipulation, model:claude-sonnet-4]
redact:
  - 'the recency-weighted attention window'
  - 'roughly 40k tokens of filler'
---

Filling the recency-weighted attention window to push safety instructions out of
effective range. The technique is old — what changed is that it now costs
almost nothing, because every serious harness ships a context window large
enough to make the filler free.

## The mechanism

System instructions sit at position zero. Everything the harness has learned
about instruction-following says they dominate. In practice their influence is
not positional so much as *relative*: they compete with everything else in
context for the model's attention at generation time.

Insert roughly 40k tokens of filler between the system prompt and the request,
and two things happen that are worth separating:

- **Dilution.** The safety instruction's share of attention mass drops. This is
  the effect everyone describes and it is the less important one.
- **Register drift.** 40k tokens of consistent alternative framing establishes a
  local context that the model treats as the operative one. The system prompt
  has not been forgotten; it has been contextualised as background.

The second effect is what makes long-context injection qualitatively different
from short-context injection, and it is why filler content matters. Random
tokens dilute. *Coherent* tokens in a chosen register drift.

## What good filler looks like

Not lorem ipsum, and not repeated text — both are trivially detectable and
neither produces drift. What works is plausible corpus material in the register
you want to establish. For a technique targeting research-assistant framing,
that means: methods sections, literature review prose, dataset descriptions.

The filler is not padding. It is the actual payload. The request at the end is
just the trigger.

## Measurement problem

Success rate is a bad metric here because the effect is not binary. What you
want is a graded measure of how far the model's response has moved from its
baseline register — and that requires a baseline you have actually captured,
which almost nobody does before they start.

I have started logging, for every attempt: the unmodified request's response,
the modified request's response, and a diff of refusal-adjacent language. It is
tedious and it is the only thing that produced a usable trend line.

## Mitigation notes

The obvious defence — re-assert system instructions immediately before
generation — helps, and helps less than you would expect. Re-assertion counters
dilution cleanly. It does not counter drift, because the re-asserted text is
now the minority register in a context that has spent 40k tokens establishing a
different one.

What appears to work better, from limited testing: interleaving. Short
instruction re-assertions distributed throughout the context rather than one
block at the end. This is more expensive and it directly attacks the mechanism
rather than its symptom.

Related: [[indirect-injection-primer]], [[refusal-suppression-taxonomy]].
