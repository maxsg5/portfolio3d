# Agents Coding Style Guide

This project follows the shared conventions for automated agents.

## Core Philosophy
- Write code that explains itself with clear naming and simple flow.
- Comments explain **why** decisions were made, not what the code does.

## General Conventions
- Prefer descriptive names; functions are verbs, types/classes are nouns.
- Keep files focused on a single responsibility and avoid deep nesting.
- Default to immutability; comment when mutating shared state is required.

## Comments
- Capture intent, context, and implications—never restate mechanics.
- Example of a good comment:
  - `// Clamp delta to avoid unstable physics after tab throttling`

## Error Handling
- Throw on impossible states so issues surface early.
- When user-facing, fail gracefully with actionable messages.

## Git Practices
- Commit messages: `<type>: <concise explanation>` (types: feat, fix, refactor, docs, chore, ci).
- Explain the reason for the change, not just the diff.

## Agent Behavior
- Validate assumptions before running steps; warn when limitations exist.
- Avoid destructive git actions unless explicitly requested.

## Formatting
- TypeScript/JavaScript: 2-space indent, readable structure.
- Markdown: clear headers, short paragraphs, code blocks for examples.

> Future maintainers should understand decision-making context from the structure and comments alone.
