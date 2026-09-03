# XPost Lite

A **100% in-browser** tool for writing X posts that are optimized for the For You feed
algorithm — built directly on the open-sourced
**[xai-org/x-algorithm](https://github.com/xai-org/x-algorithm)**.

No server. No install. No build step. No accounts. **Zero network calls** — everything
runs and stays in your browser. Open `index.html` and start writing.

---

## Quick start

- **Locally**: double-click `index.html` (works from `file://` in Chrome/Edge/Firefox), or
- **GitHub Pages**:
  Live at [https://tespio.github.io/x-post-drafter/](https://tespio.github.io/x-post-drafter/)

---

## What it DOES

### Live Phoenix Score (`Composer` tab)
Scores your draft while you type, using the algorithm's exact weighted-sum formula
(`Score = Σ weightᵢ × P(actionᵢ)` from `home-mixer/scorers/ranking_scorer.rs`) with the
weights mirrored from `home-mixer/params/param.rs` (sync 2026-08-28):

| Signal | Weight | | Signal | Weight |
|---|---|---|---|---|
| Copy-link share | **+20.0** | | Not interested | −43.2 |
| Reply | +5.0 (+15 mutuals) | | Mute | −58.8 |
| Quote | +5.0 | | Block | −31.2 |
| DM share | +5.0 | | Report | −234.0 |
| Follow author | +4.0 | | Not dwelled | −0.02 |
| Share | +2.0 | | | |
| Like | +0.5 | | Dwell | 0.05 + 0.004/s |

- **Signal breakdown** — contribution bars (weight × P(action)) so you see exactly what moves the score
- **Expected actions per 10k views** — likes/replies/reposts/quotes/shares/follows
- **Algorithm multipliers applied**: author diversity decay (post #2 today = ×0.75 … floor ×0.25),
  out-of-network/reply discount ×0.75, mutual-follow reply boost (+15)
- **Premium long-form** — toggle for 25,000-char posts with a dedicated length curve and
  reading-time dwell (0.004/s is the biggest single lever for long posts)
- **Cold-start boost indicator** — under 1,000 followers *and* 1,000 impressions, your <24h
  posts get lifted toward feed slots 15–16; the app tells you when you're eligible
- **Weighted character count** — X's real counting (URLs = 23, CJK = double), 280 or 25,000

### Compliance checker
Flags what the feed's `visibility-filtering` rules drop or limit, with the exact rule names
and concrete fixes: spam labels, engagement bait, malicious-URL patterns (shorteners/abused
TLDs), NSFW/civic-integrity/hate signals, hashtag walls, emoji walls, ALL-CAPS, link
stuffing, walls of text. A **FAIL** means non-followers (your growth audience) won't see it.

### Suggested corrections
One-click fixes chained so "✨ Apply all" works: remove bait & spam phrasing, trim hashtags
to one, context-aware ALL-CAPS fixing (keeps acronyms like ARR/TAM/SaaS), calm "!!!",
break walls of text, remove risky links, trim to the limit at sentence boundaries, add a
closing question, add a key-takeaway line.

### Optimization tips
Actionable, weight-cited advice (dwell, media, hashtags, questions, takeaways, cadence…).

### Draft library
Save drafts with their score + compliance verdict to `localStorage` — private to your
browser, survives restarts, load/delete anytime.

### Growth playbook
12 rules derived from the algorithm, each with the exact param/file citation.

---

## What it does NOT do

- ❌ **No AI generation** — this is a pure scoring, compliance and fix-suggestion tool, not a text generator
- ❌ **No URL/article fetching** — paste the article text yourself
- ❌ **No photo upload or image analysis**
- ❌ **No posting to X** — you copy your finished post into X yourself; the app never
  touches x.com and has no browser extension
- ❌ **No accounts, no server, no sync** — drafts live in *your browser's* localStorage
  (per browser, per device); clearing site data clears them
- ❌ **Not an official X tool** — and not affiliated with xAI/X Corp

---

## Privacy

**Nothing leaves your machine. Ever.** There are no network calls of any kind — no analytics,
no fonts, no CDNs, no telemetry. Your drafts and settings stay in `localStorage`. That's the
whole point of the lite version.

---

## Honesty note

X's Phoenix model predicts engagement with a private neural network; no public tool can
replicate it exactly. This app mirrors the **published scoring formula, weights, multipliers
and drop rules** from the open-sourced algorithm and estimates the action probabilities from
transparent text features. Treat scores as **relative** (draft A vs draft B), not absolute
predictions — and remember the score measures structure, not whether your take resonates.

## Files

```
index.html   the app (markup)
styles.css   dark X-style theme
engine.js    scoring engine: weights, features, probabilities, checks, corrections, tips
app.js       UI logic, drafts, settings
```
