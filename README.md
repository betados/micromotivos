# micromotivos

Interactive explainers for models of emergent social behaviour. Each model is
an essay (Markdown) with one or more interactive widgets embedded in it. A small
Python generator stitches the essay, the widgets and a shared HTML shell into a
static `index.html` per model — no build step is needed to *serve* the site,
only to *regenerate* it after an edit.

## Layout

```
build.py                     # the generator
requirements.txt             # its one dependency (markdown)
templates/
  page.html                  # shared shell for a model page
  landing.html               # shared shell for the landing page
pages/                       # THE SITE ROOT in production
  index.html                 # GENERATED (gitignored) — the landing page
  landing.css                # the landing's styles
  landing.js                 # picks the featured model at random
  schelling/                 # one folder per model, self-contained
    schelling.md             # the essay + front-matter + {{widget}} placeholders
    schelling.embed.html     # a widget fragment (HTML markup only)
    schelling.css            # this model's styles
    schelling.js             # this model's behaviour
    index.html               # GENERATED (gitignored) — do not edit by hand
```

Everything a model needs lives in its own folder under `pages/`, so models stay
independent of each other.

**`pages/` is the published root**, not the repo root: in production `pages/index.html`
is served at `/` and `pages/schelling/index.html` at `/schelling/`. See
[Deploying](#deploying).

## Setup

The generator needs the `markdown` package. On this machine Python is
externally managed, so use a virtualenv:

```bash
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt
```

## Building

```bash
./.venv/bin/python build.py            # rebuild every model under pages/
./.venv/bin/python build.py schelling  # rebuild just one model
```

Each run reads `pages/<model>/<model>.md` and writes `pages/<model>/index.html`.
Both forms also rewrite the landing `pages/index.html`, since it lists every
model.

## Viewing

Serve `pages/` — that way relative paths and URLs behave exactly as they will in
production:

```bash
cd pages && ../.venv/bin/python -m http.server
# http://localhost:8000/            the landing
# http://localhost:8000/schelling/  a model
```

## Adding a model

1. Create a folder `pages/<model>/`.
2. Write the essay `pages/<model>/<model>.md` (see front-matter below), placing a
   `{{name}}` placeholder wherever a widget should appear.
3. For each `{{name}}`, add a fragment `pages/<model>/name.embed.html` containing
   just the widget's HTML markup (no `<html>`/`<head>`/`<body>`).
4. Add the widget's `.css` and `.js` to the same folder and list them in the
   front-matter.
5. Run `./.venv/bin/python build.py <model>`. The model is picked up by the
   landing automatically — give it a `description`, that's what the landing shows.

### Front-matter

The essay starts with `key: value` lines followed by a blank line:

```markdown
title: Segregación sin segregacionistas
description: Una sociedad tolerante puede segregarse sola.
lang: es
css: schelling.css
js: schelling.js

# Segregación sin segregacionistas.

…essay text…

{{schelling}}
```

| key           | meaning                                          | default     | repeatable |
|---------------|--------------------------------------------------|-------------|------------|
| `title`       | page `<title>`, and the model's name on the landing | folder name | no      |
| `description` | `<meta name="description">`, and the model's blurb on the landing | — | no |
| `lang`        | `<html lang="…">`                                 | `en`        | no         |
| `css`         | stylesheet to link                               | —           | yes        |
| `js`          | script to link                                   | —           | yes        |

`css`/`js` paths are resolved relative to the generated `index.html` (i.e. the
model folder). A file that sits next to the essay is named directly
(`schelling.css`); a shared asset would be a path out of the folder
(e.g. `../../css/base.css`).

### Placeholders and fragments

A `{{name}}` in the Markdown is replaced by the contents of
`pages/<model>/name.embed.html`. The match tolerates the `<p>…</p>` that
Markdown wraps around a placeholder sitting on its own line, so the widget is
injected as a clean block. Use several placeholders in one essay to embed
several widgets.

### Comments

A line whose first non-blank characters are `//` is dropped before anything is
parsed — front-matter and body alike. Use it to stage content without shipping
it: comment out a widget's `{{name}}` line *and* its `js:` line and neither
reaches the page. Full-line only, so a `//` inside a URL is never a comment; to
silence a block, prefix every line.

## The landing page

`pages/index.html` is generated from `templates/landing.html` and lists every
model. It renders *all* models as featured cards; `landing.css` shows only the
first and `landing.js` swaps in a random one on load — so the featured model
varies per visit, and the page still degrades to a valid (if fixed) choice with
JavaScript off. Edit `templates/landing.html` for the copy, not `pages/index.html`.

## Social previews

Every page carries Open Graph / Twitter Card meta tags: `build.py` emits them
for model pages from `title`/`description` (absolute URLs come from its
`SITE_URL` constant), and `templates/landing.html` carries the landing's
statically. All pages share the card image `pages/card.png` (1200×630), a
committed asset drawn by `make_card.py` — rerun it only to change the card
(`./.venv/bin/pip install pillow`, then `./.venv/bin/python make_card.py`);
Pillow is deliberately not in `requirements.txt` since production never draws
the card.

## Deploying

The site is published with **`pages/` as the web root**, which is what gives the
clean `domain/schelling/` URLs. The generated `index.html` files are gitignored,
so production has to run the generator itself.

**Cloudflare Pages** (current target): connect the repo, set the build command to
`pip install -r requirements.txt && python build.py` and the output directory to
`pages`. The repo's `.python-version` pins the build's Python (3.12) to match
local development. Add the custom domain in the project's *Custom domains* tab;
if the domain is registered with Cloudflare, DNS is wired up automatically.

Note that GitHub Pages *cannot* serve this layout as-is: deploying from a branch
only offers `/` or `/docs` as the publish folder, never `/pages` — and the site
needs a build now anyway. Moving there would mean an Actions workflow that runs
`build.py` and uploads `pages/` as the artifact.

## Notes

- `.venv/`, `.idea/` and `.claude/` are gitignored — and so are the generated
  `index.html` files: rebuild locally to preview, and production regenerates
  them at deploy time.
