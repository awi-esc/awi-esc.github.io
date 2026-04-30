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

The repo uses a **two-branch model**:

- **`main`** — day-to-day working branch. Edits here do **not** affect the
  live site. People can experiment, draft content, add member profiles, etc.
  without breaking what's published.
- **`public`** — production branch. A push to this branch triggers the build.
  When you're ready to publish, fast-forward `public` to whatever commit on
  `main` you want to release:

  ```sh
  git checkout public
  git merge --ff-only main      # or: git reset --hard <main-commit>
  git push origin public
  git checkout main
  ```

The CI workflow (`.github/workflows/publish.yml`) then:

1. Runs `scripts/build_people.py` (materialises `docs/people/index.qmd` and
   copies member photos).
2. Runs `quarto render docs`.
3. Force-pushes `docs/_site/` to the `gh-pages` branch.

GitHub Pages serves from `gh-pages` / `(root)`.

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
