#!/usr/bin/env python3
"""Build the model pages under ./pages.

For every model folder `pages/<model>/` the generator:

  1. reads the essay `<model>.md` (with `key: value` front-matter),
  2. converts the markdown body to HTML,
  3. replaces every `{{token}}` with the fragment `pages/<model>/<token>.embed.html`,
  4. wraps the result in the shared shell `templates/page.html`,
  5. writes `pages/<model>/index.html`.

Front-matter keys (all optional except `title`):

    title:  page <title> and browser tab
    lang:   <html lang="…">              (default: en)
    css:    stylesheet to link           (may be repeated)
    js:     script to link               (may be repeated)

Asset paths in `css`/`js` are resolved relative to the generated
`pages/<model>/index.html`. Assets that live in the model folder are named
directly (`schelling.css`); a shared asset is a path out of the folder
(`../../css/base.css`). The pages work when opened directly from disk and need
no build step to *serve* — only to regenerate.

Usage:
    python3 build.py            # build every model under pages/
    python3 build.py schelling  # build just one model
"""

import os
import re
import sys

import markdown

ROOT = os.path.dirname(os.path.abspath(__file__))
PAGES_DIR = os.path.join(ROOT, "pages")
TEMPLATE = os.path.join(ROOT, "templates", "page.html")

# {{token}}, optionally wrapped in the <p> markdown puts around a lone line.
TOKEN_RE = re.compile(r"(?:<p>\s*)?\{\{\s*([\w.-]+)\s*\}\}(?:\s*</p>)?")


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
    md_path = os.path.join(page_dir, model + ".md")
    if not os.path.exists(md_path):
        mds = [f for f in os.listdir(page_dir) if f.endswith(".md")]
        if len(mds) != 1:
            raise SystemExit(
                f"error: {page_dir}: expected {model}.md or exactly one .md file"
            )
        md_path = os.path.join(page_dir, mds[0])

    html, meta = render_markdown(md_path)
    html = embed_fragments(html, page_dir)

    out_path = os.path.join(page_dir, "index.html")
    styles, scripts = asset_tags(meta)

    title = meta.get("title", [model])[0]
    lang = meta.get("lang", ["en"])[0]

    page = (
        template
        .replace("{lang}", lang)
        .replace("{title}", title)
        .replace("{styles}", styles)
        .replace("{scripts}", scripts)
        .replace("{content}", indent(html, 4))
    )

    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(page)
    print(f"built {os.path.relpath(out_path, ROOT)}")


def main(argv):
    with open(TEMPLATE, encoding="utf-8") as fh:
        template = fh.read()

    if argv:
        dirs = [os.path.join(PAGES_DIR, name) for name in argv]
    else:
        dirs = [
            os.path.join(PAGES_DIR, name)
            for name in sorted(os.listdir(PAGES_DIR))
            if os.path.isdir(os.path.join(PAGES_DIR, name))
        ]

    for page_dir in dirs:
        if not os.path.isdir(page_dir):
            raise SystemExit(f"error: not a folder: {page_dir}")
        build_page(page_dir, template)


if __name__ == "__main__":
    main(sys.argv[1:])
