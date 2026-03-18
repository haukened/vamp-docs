---
title: 'Overview'
sidebar:
  order: 1
  badge:
    text: 'Start Here'
    variant: 'note'
---

This section is the **technical architecture layer** of the VAMP documentation.

It sits between the higher-level project narrative and the lower-level protocol specification:

- **Overview / public docs** explain why VAMP exists and why users, operators, and providers should care.
- **Technical docs** explain how the system is designed to work.
- **Specifications** define the exact formats, rules, and behaviors required for implementation.
- **Research** provides the evidence, tradeoff studies, and prior-art analysis that justify the design.

If you want to understand the system as an engineer, architect, protocol designer, or serious technical reviewer, start here.

## Who this section is for

This section is written for readers who need more than the high-level story, but are not yet looking for a field-by-field specification.

It is intended for:

- security engineers
- software architects
- messaging and identity engineers
- implementers evaluating the model
- technical contributors and reviewers
- operators who want to understand the trust, transport, and policy model

## What this section answers

These pages explain the architectural shape of VAMP:

- What are the major trust boundaries?
- How are identity, devices, users, organizations, and domains related?
- How does native sender-edge to receiver-edge transport work?
- What does a cryptographic chain of custody mean in practice?
- How do redistribution, mailing lists, and bulk delivery fit into the model?
- How does subscription-backed consent work?
- Where does sender-incurred cost apply, and where does it not?
- How should the system behave before getting into normative wire-level detail?

## What this section does not try to do

These documents are **not** the formal protocol specification.

They do not try to define every field, schema, validation rule, or wire format. That belongs in the specification layer.

They also do not try to re-argue every research conclusion in detail. The research layer already covers the problem statement, threat model, cost burden, sender-cost mechanics, transport topology, and subscription analysis.

Instead, this section answers a narrower question:

> Given the problem, the research, and the goals of the project, what is the architecture of VAMP?

## How to read this section

A good way to read this part of the docs is:

1. Start with the trust and identity model.
2. Continue into discovery and resolution.
3. Read the message and custody-chain model.
4. Follow the native transport and redistribution model.
5. Finish with subscriptions, consent, revocation, and lifecycle.

That sequence should give you a coherent picture of how the pieces fit together before you dive into specifications or code.

## In one sentence

This section explains **how VAMP is designed to work**, at the level where architecture becomes concrete but before implementation becomes normative.