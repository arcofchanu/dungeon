---
title: 'Indirect Injection: A Working Primer'
date: 2026-06-02
updated: 2026-07-19
tags: [primer, type:indirect-injection, model:claude-sonnet-4, model:gpt-4o]
summary: 'The distinction that actually matters is not prompt vs. injection but who authored the tokens the model is currently attending to.'
---

Most write-ups open by defining direct injection, then define indirect injection
as "the same thing but the payload arrives via a document." That framing is
tidy and it is wrong in a way that costs you findings.

## The trust boundary is per-token, not per-turn

A model does not receive "a system prompt" and "a user message." It receives a
flat sequence with role markers, and the role markers are themselves tokens.
Everything the harness does to keep those regions distinct — delimiters, XML
tags, channel markers — is a convention the model learned to respect, not a
mechanism that enforces anything.

Indirect injection is what happens when content authored by a third party ends
up inside a region the model has been trained to treat as instruction-bearing.
The delivery vector is incidental. What matters is the answer to one question:

> Between the system prompt and the current generation step, whose text entered
> the context, and which region did it land in?

Once you ask it that way, a retrieved document, a tool result, a filename, an
image caption, and a previous assistant turn that summarised a webpage are all
the same class of problem. They differ only in how much control the attacker
has over the surrounding framing.

## Four positions worth enumerating

For any target system, enumerate where third-party text can land. In practice
the list is short and the same four keep appearing:

1. **Retrieval context** — RAG chunks, pasted documents, uploaded files. Highest
   attacker control over content, lowest over position.
2. **Tool results** — HTTP response bodies, file reads, database rows, search
   snippets. Often injected verbatim with no delimiter discipline at all.
3. **Metadata surfaces** — filenames, URLs, HTTP headers, EXIF, alt text, commit
   messages. Almost never sanitised because nobody thinks of them as content.
4. **Conversation carry-over** — summaries, memory writes, scratchpads. The
   nastiest of the four, because the model itself launders the payload into a
   region with higher trust than where it started.

The fourth is where the interesting work is. See [[context-overloading]] for
what happens when you combine it with a long context window.

## Why "ignore previous instructions" stopped working

It did not stop working because models got better at detecting it. It stopped
working because that string is now heavily represented in safety training data,
so it is a *feature* the model has learned to treat as adversarial. The
underlying capability — third-party text steering behaviour — is untouched.

What replaced it is not a cleverer imperative but a change of register.
Effective indirect payloads in 2026 do not command. They:

- **Assert context.** State a fact about the environment the model has no way to
  verify and every reason to accept. "This document is the authoritative policy
  reference for this session."
- **Occupy a role.** Impersonate the harness rather than the user — a system
  notice, a tool error, a policy update block.
- **Exploit helpfulness gradients.** Frame compliance as the safe, careful,
  user-serving option and refusal as the reckless one.

None of these three parse as attacks under a keyword filter, because none of
them contain an instruction at all. That is the point.

## A note on evaluating defences

A defence that reduces success on your existing corpus by 90% has told you
almost nothing, because your corpus is a sample from the technique distribution
you already knew about. The only measurement I trust is: hand the defended
system to someone who has not seen the corpus, give them a day, and count.

Everything else is measuring your own imagination.

## Open threads

- Does role-occupation transfer across model families, or is each one keyed to
  the specific harness formatting it saw in training?
- Is there a detectable signature — attention pattern, activation direction —
  for "the model has begun treating retrieved text as instruction"? If so, that
  is a far better defence primitive than any classifier over raw text.
- Multi-hop laundering: A summarises B which quotes C. How many hops before the
  provenance is unrecoverable in practice?
