# Leaderboard

* **On this device** — always works; the best 50 wins are kept in the browser (`h3js_board_v1`).
* **Global** — needs one Cloudflare KV namespace for the Worker in `worker/index.js`:

```bash
npx wrangler kv namespace create SCORES
```

Paste the printed `id` into `wrangler.toml` (uncomment the `[[kv_namespaces]]` block) and redeploy. Until then the API answers 503 and the game shows "online board not set up yet".

The Worker keeps four sorted key families per score (all, per difficulty, per size, per both) so the lists load with a single KV `list`. It sanitises names, caps scores, requires a plausible day count, and allows one submission per IP per minute. Scores are submitted by the browser, so treat the global board as friendly competition, not tamper-proof.
