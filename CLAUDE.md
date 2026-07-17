# CLAUDE.md

Orientation for future sessions. Kept deliberately thin: **`README.md` is the
source of truth** for the workflow — read it before doing anything non-trivial.
This file records only stable facts and the traps that aren't obvious from the
code.

## What this is

Static site of interactive explainers for models of emergent social behaviour.
Each model = an essay (Markdown) + interactive widget(s), stitched into a static
`index.html` by a small Python generator (`build.py`). No build step is needed
to *serve* the site, only to *regenerate* pages after edits.

## Working here

- Python is externally managed on this machine — use the venv:
  `./.venv/bin/python build.py [model]` (create it once per README setup).
- **Never hand-edit `pages/<model>/index.html`** — it is generated. Edit the
  source (`<model>.md`, `*.embed.html`, `*.css`, `*.js`) and rerun `build.py`.
- After editing any source in a model folder, rebuild that model.
- Verify a widget by confirming every element id its JS reads exists in the
  generated page and its linked assets resolve — a missing id makes the IIFE
  throw and the widget dies silently. (A browser isn't available in-session.)

## Where things live

- `build.py` — the generator; its module docstring documents front-matter and
  the `{{placeholder}}` → `name.embed.html` mechanism.
- `pages/` — **the published web root**, not the repo root. Deployed to Cloudflare
  Pages with output dir `pages` and build command
  `pip install -r requirements.txt && python build.py` — the generated
  `index.html` files are gitignored, so production regenerates them. Served as
  `pages/index.html` → `/`, `pages/schelling/index.html` → `/schelling/`.
  Preview it the same way: `cd pages && ../.venv/bin/python -m http.server`.
- `pages/<model>/` — self-contained: essay, widget fragment(s), css, js, and the
  generated `index.html`. Assets are colocated and linked by bare name.
- `pages/index.html` — GENERATED landing, from `templates/landing.html` +
  every model's `title`/`description` front-matter. Rebuilt on every `build.py`
  run, including single-model runs, because it lists all models.
- `templates/page.html`, `templates/landing.html` — the two outer HTML shells.
