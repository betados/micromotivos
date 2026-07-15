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
  page.html                  # shared outer HTML shell
pages/
  schelling/                 # one folder per model, self-contained
    schelling.md             # the essay + front-matter + {{widget}} placeholders
    schelling.embed.html     # a widget fragment (HTML markup only)
    schelling.css            # this model's styles
    schelling.js             # this model's behaviour
    index.html              # GENERATED — do not edit by hand
index.html                   # site root (currently the standalone Schelling app)
```

Everything a model needs lives in its own folder under `pages/`, so models stay
independent of each other.

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

## Viewing

Open a generated `pages/<model>/index.html` directly in a browser, or serve the
whole project so relative paths behave exactly as they will in production:

```bash
./.venv/bin/python -m http.server
# then visit http://localhost:8000/pages/schelling/
```

## Adding a model

1. Create a folder `pages/<model>/`.
2. Write the essay `pages/<model>/<model>.md` (see front-matter below), placing a
   `{{name}}` placeholder wherever a widget should appear.
3. For each `{{name}}`, add a fragment `pages/<model>/name.embed.html` containing
   just the widget's HTML markup (no `<html>`/`<head>`/`<body>`).
4. Add the widget's `.css` and `.js` to the same folder and list them in the
   front-matter.
5. Run `./.venv/bin/python build.py <model>`.

### Front-matter

The essay starts with `key: value` lines followed by a blank line:

```markdown
title: Segregación sin segregacionistas
lang: es
css: schelling.css
js: schelling.js

# Segregación sin segregacionistas.

…essay text…

{{schelling}}
```

| key     | meaning                                   | default | repeatable |
|---------|-------------------------------------------|---------|------------|
| `title` | page `<title>` / browser tab              | folder name | no     |
| `lang`  | `<html lang="…">`                          | `en`    | no         |
| `css`   | stylesheet to link                        | —       | yes        |
| `js`    | script to link                            | —       | yes        |

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

## Notes

- `.venv/`, `.idea/` and `.claude/` are gitignored. The generated `index.html`
  files are committed, so the site serves as-is with no build step.
- The site root `index.html` is still the original standalone Schelling app. A
  natural next step is to turn it into a landing page that links to each model
  under `pages/`.
