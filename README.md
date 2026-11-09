# OptiPrompt

OptiPrompt is a prompt-refinement web app built with React, TypeScript, Express, Firebase Authentication, and Firestore. It applies deterministic prompt cleanup, then asks an AI provider to refine the prompt. It tries Groq first, rotates to a second Groq key on failure, and falls back to Gemini.

## What it does

- Offers cheap, quality, and extreme rewrite modes.
- Sends AI requests through an Express server; provider keys stay server-side.
- Requires a Firebase ID token on the optimizer endpoint, limits prompts to 10,000 characters, and applies a per-user in-memory rate limit.
- Reports provider-returned input/output tokens and latency. API cost is an estimate at published standard rates; the actual bill may differ, especially for free-tier usage.
- Shows prompt-size change using a rough four-characters-per-token estimate. This is not a tokenizer measurement and is not represented as a guaranteed cost saving.
- Saves prompt history to Firestore only after the user opts in under Settings. The preference is local to that browser. Users can clear saved history in the dashboard.

## Architecture

```text
React client ── Firebase ID token ──> Express /api/optimize
                                           ├─ Groq key 1
                                           ├─ Groq key 2
                                           └─ Gemini fallback

Firebase Auth <── sign-in                 Firestore <── opt-in prompt history
```

The Express rate limiter is held in process memory. It is suitable for a single-instance demo deployment; use a shared store such as Redis before running multiple server instances. The API does not log prompt text.

## Local setup

Requirements: Node.js 20 or later and npm.

1. Install packages with `npm ci`.
2. Copy `.env.example` to `.env` and set at least one provider key. The provider keys must not use a `VITE_` prefix.
3. Enable Google sign-in in Firebase Authentication and configure the authorized domains for your local and deployed app.
4. Deploy `firestore.rules` to the Firebase project, or run the local emulator workflow described below.
5. Start the app with `npm run dev` and open `http://localhost:3000`.

### Environment variables

- `GROQ_API_KEY`: primary Groq key.
- `GROQ_API_KEY_2`: optional Groq key attempted after the primary fails.
- `GEMINI_API_KEY`: optional Gemini fallback key, tried after all configured Groq keys fail.
- `API_RATE_LIMIT_PER_MIN`: optimizer requests allowed per user per minute; defaults to 10.
- `PORT`: server port; defaults to 3000.

Firebase web configuration lives in `firebase-applet-config.json`. It is client configuration, not a server credential; enforce access through Firebase Auth and Firestore Rules.

## Verification

```bash
npm test        # Unit and API integration tests (provider calls are mocked)
npm run lint    # TypeScript check
npm run build   # Production frontend build
```

Run the Firestore emulator and rule tests with:

```bash
npm run test:rules
```

## Prompt evaluation

`benchmarks/cases.json` contains 50 prompts across coding, summarization, writing, analysis, and reasoning. Run the full benchmark with `npm run benchmark`; this makes provider requests and can incur usage. Use `npm run benchmark -- --limit=5` for a smaller run. Reports are written to the ignored `benchmarks/results/` directory.

The benchmark measures approximate prompt-size change, provider usage, latency, and exact retention of required marker phrases. Marker retention is only a regression signal; it does not prove semantic quality. Complete the human review template and report fidelity/clarity scores before making quality claims. No benchmark result is claimed until a run has been reviewed.

## Deployment

A Dockerfile and Render blueprint are included. Set provider keys as secret environment variables in the deployment host. Configure Firebase Authentication authorized domains for the deployed hostname and deploy the Firestore Rules. The health check is `GET /api/healthz`.

Before a public launch, configure a shared rate-limit store for multi-instance deployments, set provider budgets/alerts, and review the prompts sent to third-party providers against your data policy.

## Published rate references

The current estimate constants in `server/providers.ts` were checked on 2026-11-09 against [Groq model pricing](https://console.groq.com/docs/models) and [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing). Update them when provider rates change. Gemini's displayed estimate uses the published paid standard rate, even if the account uses a free tier.
