# OptiPrompt evaluation benchmark

`cases.json` is a 50-case starter set across coding, summaries, writing, analysis, and reasoning. `npm run benchmark` sends one optimization request for every case using configured provider keys. This can incur provider usage; use `npm run benchmark -- --limit=5` for a small run. Results are written under `benchmarks/results/` (git-ignored).

The runner reports approximate prompt-size change using four characters per token, actual provider-reported tokens and latency, fallback use, and exact preservation of the case's required markers. Marker retention is a narrow regression check; it is not a semantic-quality score. Review each output manually using `human-review-template.csv` before claiming quality or semantic preservation.

## Human review rubric

Score each output 1–5 for fidelity (all requirements preserved), clarity, and usefulness. Reviewers should compare input and output without seeing the provider name when practical. Report the number of prompts, median prompt-size change, marker retention, and mean human rubric scores. Do not claim token savings as a measured tokenizer result: the displayed prompt-size change is approximate.
