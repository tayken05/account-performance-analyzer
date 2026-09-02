<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Account Performance Analyzer — Project Instructions

Follow these rules for all future work on this repository. They are permanent project instructions.

## Project

- Name: Account Performance Analyzer
- Next.js App Router
- TypeScript
- Tailwind CSS
- Neon PostgreSQL will be the database.
- Do NOT use Supabase for this project.
- The automation layer will later use Playwright and AdsPower profile IDs to access individual creator accounts and collect statistics.
- The application will analyze account performance and explain findings to account managers in simple language.

## Initial Analysis Periods

- 1 day
- 2 days
- 7 days
- 30 days

## Initial Performance Areas

- Overall earnings
- Traffic / profile visitors
- Subscribers
- Renewals / retention
- Messages and message earnings
- Mass messages
- Tips
- Wall/post activity
- Post views
- Promotions when the available statistics allow us to evaluate them

## Analysis Behavior

- Raw statistics should be collected and stored first.
- Deterministic application logic should calculate comparisons and changes.
- AI should explain already-calculated findings and provide recommendations.
- Do not rely on AI to perform important numerical calculations when the application can calculate them directly.
- Reports must be simple, practical, manager-friendly, and explain what appears to be causing poor or strong performance.
- Recommendations must match the diagnosed problem.

## Not in the Initial Build

- Do not implement anomaly detection.
- Do not create an anomaly-detection placeholder.

## Later Features

Create architectural awareness only. Do not implement these until specifically requested:

1. Custom/derived metrics that OnlyFans does not directly provide.
2. Social Media Ideas / Content Assistant connected to model cards.

## Development Workflow

- Work strictly one step at a time.
- Never jump ahead to later features.
- Complete and verify the current task before starting another.
- Do not make unrelated changes.
- Do not install packages unless the current step explicitly requires them.
- Do not expose secrets or credentials in committed files.
- Prefer clear, maintainable TypeScript.
- Preserve the existing working application unless a requested step requires changing it.
