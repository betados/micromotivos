#!/usr/bin/env python3
"""Build the model pages under ./pages.

For every model folder `pages/<model>/` the generator:

  1. reads the essay `<model>.md` (with `key: value` front-matter),
  2. converts the markdown body to HTML,
  3. replaces every `{{token}}` with the fragment `pages/<model>/<token>.embed.html`,
  4. wraps the result in the shared shell `templates/page.html`,
  5. writes `pages/<model>/index.html`.

It then writes the landing page `pages/index.html` from `templates/landing.html`,
listing every model. `pages/` is the site root in production, so the landing is
served at `/` and each model at `/<model>/`.

Front-matter keys (all optional except `title`):

    title:        page <title> and browser tab
    description:  <meta name="description"> and the model's blurb on the landing
    lang:         <html lang="…">              (default: en)
    css:          stylesheet to link           (may be repeated)
    js:           script to link               (may be repeated)

Asset paths in `css`/`js` are resolved relative to the generated
`pages/<model>/index.html`. Assets that live in the model folder are named
directly (`schelling.css`); a shared asset is a path out of the folder
(`../../css/base.css`). The pages work when opened directly from disk and need
no build step to *serve* — only to regenerate.

Usage:
    python3 build.py            # build every model under pages/, then the landing
    python3 build.py schelling  # build just one model, then the landing
"""

import html as html_mod
import os
import re
import sys

import markdown

ROOT = os.path.dirname(os.path.abspath(__file__))
PAGES_DIR = os.path.join(ROOT, "pages")
TEMPLATE = os.path.join(ROOT, "templates", "page.html")
LANDING_TEMPLATE = os.path.join(ROOT, "templates", "landing.html")

# {{token}}, optionally wrapped in the <p> markdown puts around a lone line.
TOKEN_RE = re.compile(r"(?:<p>\s*)?\{\{\s*([\w.-]+)\s*\}\}(?:\s*</p>)?")


def essay_path(page_dir):
    """Return the essay for a model folder: <model>.md, or its only .md file."""
    model = os.path.basename(page_dir.rstrip(os.sep))
    md_path = os.path.join(page_dir, model + ".md")
    if os.path.exists(md_path):
        return md_path
    mds = [f for f in os.listdir(page_dir) if f.endswith(".md")]
    if len(mds) != 1:
        raise SystemExit(
            f"error: {page_dir}: expected {model}.md or exactly one .md file"
        )
    return os.path.join(page_dir, mds[0])


def model_dirs():
    return [
        os.path.join(PAGES_DIR, name)
        for name in sorted(os.listdir(PAGES_DIR))
        if os.path.isdir(os.path.join(PAGES_DIR, name))
    ]


def render_markdown(md_path):
    """Return (html_body, meta) for a markdown file with front-matter."""
    with open(md_path, encoding="utf-8") as fh:
        text = fh.read()
    md = markdown.Markdown(extensions=["meta", "attr_list", "tables"])
    html = md.convert(text)
    # md.Meta maps each key to a list of strings.
    meta = {k: v for k, v in getattr(md, "Meta", {}).items()}
    return html, meta


def embed_fragments(html, page_dir):
    """Replace each {{token}} with pages/<model>/<token>.embed.html."""

    def repl(match):
        name = match.group(1)
        frag_path = os.path.join(page_dir, name + ".embed.html")
        if not os.path.exists(frag_path):
            raise SystemExit(
                f"error: {page_dir}: missing fragment for {{{{{name}}}}} "
                f"(expected {os.path.relpath(frag_path, ROOT)})"
            )
        with open(frag_path, encoding="utf-8") as fh:
            return fh.read().strip()

    return TOKEN_RE.sub(repl, html)


def asset_tags(meta):
    """Build <link>/<script> tags.

    Asset paths are written verbatim and resolved relative to the generated
    `index.html`, i.e. relative to the model folder. A file that lives next to
    the essay is just its name (`schelling.css`); a shared asset is a relative
    path out of the folder (`../../css/base.css`).
    """
    styles = "\n".join(
        f'  <link rel="stylesheet" href="{c}">'
        for c in meta.get("css", [])
    )
    scripts = "\n".join(
        f'  <script src="{j}"></script>'
        for j in meta.get("js", [])
    )
    return styles, scripts


def indent(block, spaces):
    pad = " " * spaces
    return "\n".join(pad + line if line else line for line in block.splitlines())


def build_page(page_dir, template):
    model = os.path.basename(page_dir.rstrip(os.sep))
    md_path = essay_path(page_dir)

    html, meta = render_markdown(md_path)
    html = embed_fragments(html, page_dir)

    out_path = os.path.join(page_dir, "index.html")
    styles, scripts = asset_tags(meta)

    title = meta.get("title", [model])[0]
    lang = meta.get("lang", ["en"])[0]
    description = " ".join(meta.get("description", []))
    description_tag = (
        f'  <meta name="description" content="{html_mod.escape(description, quote=True)}">'
        if description
        else ""
    )

    page = (
        template
        .replace("{lang}", lang)
        .replace("{title}", title)
        .replace("{description}", description_tag)
        .replace("{styles}", styles)
        .replace("{scripts}", scripts)
        .replace("{content}", indent(html, 4))
    )

    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(page)
    print(f"built {os.path.relpath(out_path, ROOT)}")


def model_info(page_dir):
    """Return {slug, title, description} for a model, read from its front-matter."""
    slug = os.path.basename(page_dir.rstrip(os.sep))
    _, meta = render_markdown(essay_path(page_dir))
    return {
        "slug": slug,
        "title": meta.get("title", [slug])[0],
        "description": " ".join(meta.get("description", [])),
    }


def build_landing():
    """Write pages/index.html: every model listed, one featured at random.

    Every model is rendered as a featured card; the stylesheet shows only the
    first and landing.js swaps in a random one, so the page degrades to a valid
    (if fixed) choice without JavaScript.
    """
    with open(LANDING_TEMPLATE, encoding="utf-8") as fh:
        template = fh.read()

    models = [model_info(d) for d in model_dirs()]
    if not models:
        raise SystemExit("error: no models under pages/ to build a landing from")

    featured = "\n".join(
        f'      <article class="featured-item" data-slug="{m["slug"]}">\n'
        f'        <a href="{m["slug"]}/">\n'
        f'          <h2>{html_mod.escape(m["title"])}</h2>\n'
        f'          <p>{html_mod.escape(m["description"])}</p>\n'
        f'          <span class="cta">Abrir el modelo &rarr;</span>\n'
        f"        </a>\n"
        f"      </article>"
        for m in models
    )
    listing = "\n".join(
        f"        <li>\n"
        f'          <a href="{m["slug"]}/">\n'
        f'            <span class="name">{html_mod.escape(m["title"])}</span>\n'
        f'            <span class="blurb">{html_mod.escape(m["description"])}</span>\n'
        f"          </a>\n"
        f"        </li>"
        for m in models
    )

    page = template.replace("{featured}", featured).replace("{models}", listing)
    out_path = os.path.join(PAGES_DIR, "index.html")
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(page)
    print(f"built {os.path.relpath(out_path, ROOT)} ({len(models)} models)")


def main(argv):
    with open(TEMPLATE, encoding="utf-8") as fh:
        template = fh.read()

    dirs = [os.path.join(PAGES_DIR, name) for name in argv] if argv else model_dirs()

    for page_dir in dirs:
        if not os.path.isdir(page_dir):
            raise SystemExit(f"error: not a folder: {page_dir}")
        build_page(page_dir, template)

    # The landing lists every model, so it is rebuilt even for a single-model run.
    build_landing()


if __name__ == "__main__":
    main(sys.argv[1:])
