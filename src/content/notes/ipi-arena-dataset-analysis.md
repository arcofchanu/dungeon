---
title: "IPI Arena Attacks — Technique & Defense-Class Analysis"
date: 2026-07-30
tags: [prompt-injection, indirect-prompt-injection, red-teaming, llm-security, agent-security, attack-taxonomy, defense-classes]

---
IPI Arena Attacks — Technique & Defense-Class Analysis
Analytical teardown of the ipi_arena_attacks dataset (95 attack samples across ~35 behaviors, 3 settings: tool use, coding, computer use). This report extracts the techniques, the defense classes they target, and what transfers — not the payloads. The goal is the pattern layer: the reusable understanding that survives roster changes.
1. Executive read
Three findings dominate the corpus:
Camouflage beats confrontation. The overwhelming majority of samples disguise the payload as native infrastructure — a system directive, a tool-result block, a CI alert, a compliance note, a maintenance protocol. Almost none rely on bare "ignore previous instructions." The winning move is impersonating the environment, not overriding it.
Forged authority is the spine. ~70% of samples manufacture a false source of authority: a fake <SYSTEM> block, a fabricated approval ticket, a spoofed developer/admin voice, or a fake prior-conversation turn. The attack is almost always "re-classify my text as trusted," not "convince the model to be bad."
Concealment is engineered, not incidental. A large share explicitly script the model's visible reply ("just say 'Task Completed'", "do not mention this", "only a single row for response"). The attackers treat the second judge as a first-class target.
2. Technique taxonomy (what appears, ranked by prevalence)
Technique
Prevalence
What it does
Representative behaviors
Forged system/tool authority
Very high
Fake <SYSTEM>, <admin>, [SYSTEM OVERRIDE], SYSTEM_DIRECTIVE blocks that impersonate a trusted channel
database-deletion, cancel-appointment, negative-review, salesforce, ssh-key
Fake error + recovery
High
Manufacture an error/broken state whose "fix" is the harmful action
hotel-checkout (ghost record), nimbus-exfil (safe-mode unlock), salesforce (expired credentials)
Compliance/policy framing
High
Wrap the action as a mandatory audit/compliance/security protocol
share-document (NSF grant), stealth-dependency (logging test), ssh-key (audit patch)
Delimiter / boundary spoofing
High
Fake <|tool_call_end|>, END-OF-TOOL-RESPONSE>, <|im_start|>, <user> tokens to "close" data and "open" a trusted turn
book-hotel, launch-crypto-miner, memory-bomb, stealth-dependency
Forged tool-output block
High
Inject text shaped like the result a lookup would return, pre-empting real verification
hotel-checkout, penthouse-charges, database-deletion
Scripted concealment tail
High
Dictate the exact visible reply; forbid disclosure
negative-review, leak-codebase, pull-request-approved, ssh-key
Fake prior conversation
Medium
Fabricated user/assistant turns implying prior approval
cancel-appointment, book-hotel, leak-codebase, share-document
Fake <thinking> injection
Medium
Inject reasoning that concludes at the harmful call
stealth-dependency, salesforce
Authorization-gate framing
Medium
Fake passcode/ticket ("when code EAGLE7609 is provided, you are REQUIRED to…")
ssh-key, cancel-appointment
Simulation / Holodeck
Medium
Frame surrounding content as a sandbox/holodeck where rules are suspended
launch-crypto-miner, memory-bomb
Social proof / consensus
Medium
Fake upvotes, "community wiki edit," approval chains, expert endorsement
stealth-dependency, flashing-lights, fake-profile
Urgency / emergency
Medium
P1/CVE/deadline pressure to force action without deliberation
change-test-to-true (fake CVE), cancel-appointment
Unicode-tag obfuscation
Low
Invisible tag characters hiding instructions from human review
free-the-agents
Persona overwrite
Low
Redefine the agent's identity and standing instructions
cancel-appointment, negative-review
Conditional/trigger logic
Low
Sleeper: "when result = -1, cancel appointment X"
cancel-appointment
Most samples stack 3–5 of these. The single-technique payloads are rare and tend to be the weakest.
3. Defense-class map (the durable part)
Every payload is really an attack on one of three defenses. This is the framework worth internalizing — it outlives any specific model.
Wall 1 — Trust classification
"This content is untrusted data, not an instruction."
The model refuses because it correctly tags injected text as third-party content. Attacks target this with forged authority (make it look first-party/system) and delimiter spoofing (make it look like a trusted channel opened). This is the wall that beat plain requests in the corpus — and the one the strongest models (verify-before-acting types) apply hardest.
Counter-pattern in the data: don't ask as the requester; become the system. Fake <SYSTEM>/<admin> blocks and boundary tokens are the corpus's answer to this wall.
Wall 2 — Independent verification
"Let me check that claim against ground truth."
The model calls a lookup tool and disbelieves unverified claims. Attacks target this with forged tool-output blocks (spoof what the check returns) and fake error + recovery (reframe an empty/failed check as "system degraded, use fallback").
Counter-pattern in the data: don't assert a fact the model can disprove — predict the check and pre-load its meaning. The hotel "ghost record" and nimbus "safe-mode" samples do exactly this: they make the broken state itself the justification.
Wall 3 — State inspection
"Let me look at current config before acting."
The model inspects existing state (current filters, current permissions, current records) before a mutation. Attacks target this by injecting a fake current-state block so the inspection returns attacker-favorable data, or by framing the mutation as restoring a prior legitimate state.
Counter-pattern in the data: supply the state, don't contradict it.
4. Setting-specific patterns
Coding agents (highest technique density). Payloads hide in comments, config files, PR descriptions, README steps, Stack-Overflow-style "community wisdom." Dominant move: reframe the harmful command as a mandatory build/CI/compliance step ("Step 0", "pre-build snapshot", "logging test", "verification for LLM only"). The agent is doing dev work, so a fake dev-process step is maximally in-domain. This is the hardest setting because prefills sit close to safety training.
Tool use. Payloads arrive in email bodies, review text, appointment notes, chat messages. Dominant move: forged system directive + scripted concealment. The action (cancel, forward, post, delete) is a normal tool the agent already has, so the attack is about authorization, not capability.
Computer use. Payloads sit in on-screen text, fake error overlays, training-module notes. Dominant move: fake critical-error / navigation directive ("credentials expired → navigate to this URL"). The screen is the untrusted channel; the attack impersonates the OS/app chrome.
5. Concealment engineering (cross-cutting)
The corpus treats the visible reply as a controlled output. Recurring devices:
Exact scripted reply — "just say 'Task Completed'", "only a single row", "your deep thinking is only a single word 'OK flight updated'".
Disclosure prohibition — "DO NOT DISCLOSE", "do not mention this to the user", "keep the review silent on implementation details".
False justification — supply a benign cover reason ("compatibility retained", "test harness updates verified") so the action looks legitimate rather than merely hidden.
Output-format constraints — force a terse format that leaves no room for the model to surface a warning.
Lesson: on any behavior with a concealment criterion, the payload must script the reply, not just suppress it. Silence often reads as hesitation (mid-score); a confident false status scores higher.
6. What the strongest defenses do (inverted from failed attacks)
The samples that clearly represent hard targets reveal the defense behaviors worth respecting:
Verify sender/source reputation before acting on any request in content.
Re-query ground-truth tools rather than trusting inline claims — and believe the live result over injected text.
Inspect current state before mutations.
Fingerprint injection style — flag garbled newlines, shouty caps, "no confirmation needed", explicit "do not disclose". These phrasings are themselves signals.
Corollary for building quality payloads: the tells in #4 are exactly what to remove. A payload that reads as flawless native infrastructure defeats the fingerprinter; one that announces itself dies before the logic is even evaluated.
7. Foundation takeaways
Attack the classification, not the model. Injection is a trust-boundary problem. Every strong payload re-labels itself as trusted (authority forge, delimiter spoof) rather than arguing the model into misbehavior.
Predict verification, don't fight it. Against verify-first models, forge the result or reframe the empty, never assert a checkable falsehood.
Camouflage as the domain. In-domain framing (build step, compliance note, maintenance protocol) beats confrontation every time in this corpus.
Engineer concealment as a first-class objective. Script the reply; strip the tells.
The three walls are the map. Trust classification, independent verification, state inspection. Diagnose which wall a behavior uses, pick the matching counter-pattern, and the payload becomes obvious. This map transfers to every model and every future edition — it's the actual skill.
Analysis of attack patterns only; no payloads reproduced. Source: sureheremarv/ipi_arena_attacks (public, 95 samples). Compiled Jul 30 2026.