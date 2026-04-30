# awi-esc.github.io

Source for the **AWI Earth System Complexity** group website, built with
[Quarto](https://quarto.org) and published to GitHub Pages.

**Live site:** <https://awi-esc.github.io>

## Layout

```
docs/                          Quarto site source
  _quarto.yml                  site config (navbar, theme)
  index.qmd                    landing page
  research.qmd
  publications/
    index.qmd
    references.bib             bibliography (BibTeX)
  assets/
    logo.png
    css/custom.scss            colours sampled from the logo
  people/index.qmd             AUTO-GENERATED — do not edit
  assets/people/<slug>/        AUTO-GENERATED — do not edit

members/                       member-managed profiles
  README.md                    contributor guide
  <slug>/info.yml + photo.*

scripts/
  build_people.py              members/ → docs/people/index.qmd

.github/workflows/publish.yml  CI: build + push to gh-pages
```

## How publishing works

1. Push to `main` triggers `.github/workflows/publish.yml`.
2. The workflow runs `scripts/build_people.py` (which materialises
   `docs/people/index.qmd` and copies photos), then `quarto render docs`.
3. The built site (`docs/_site/`) is force-pushed to the `gh-pages` branch.
4. GitHub Pages serves from `gh-pages` / `(root)`.

> **GitHub Pages settings**: in Settings → Pages, set source to
> **Branch: `gh-pages`** with folder **`/ (root)`** (not `/docs`).

## Local preview

```sh
pip install pyyaml          # one-time
python scripts/build_people.py
quarto preview docs
```

Quarto auto-reloads on file changes. If you edit something under `members/`,
re-run `build_people.py` to regenerate the People page.

## Adding content

- **A new member**: see [members/README.md](members/README.md).
- **A publication**: append a BibTeX entry to
  [docs/publications/references.bib](docs/publications/references.bib), then
  switch the publications page front-matter to the bib-driven version (see the
  comment in [docs/publications/index.qmd](docs/publications/index.qmd)).
- **A research theme**: edit [docs/research.qmd](docs/research.qmd), or add a
  sub-page under `docs/research/` and link it from there.
- **Site colours / styling**: edit
  [docs/assets/css/custom.scss](docs/assets/css/custom.scss).
