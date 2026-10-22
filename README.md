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
  highlights/
    index.qmd                  listing of all highlights
    <slug>/index.qmd           one research highlight (+ figures, scripts)
  students.qmd                 "For students" page (includes _topics.qmd)
  _topics.qmd                  AUTO-GENERATED — do not edit
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

topics/                        student thesis topics
  README.md                    contributor guide
  <slug>.yml

scripts/
  build_people.py              members/ → docs/people/index.qmd
  build_topics.py              topics/ → docs/_topics.qmd

.github/workflows/publish.yml  CI: build + push to gh-pages
```

## How publishing works

The repo uses a **two-branch model**:

- **`main`** — day-to-day working branch. Edits here do **not** affect the
  live site. People can experiment, draft content, add member profiles, etc.
  without breaking what's published.
- **`public`** — production branch. A push to this branch triggers the build.
  When you're ready to publish, open a pull request from `main` into `public`
  and merge it:

  ```sh
  gh pr create --base public --head main --title "Publish" --body ""
  gh pr merge --merge
  ```

  `public` contains these merge commits, so it cannot be fast-forwarded to
  `main`.

The CI workflow (`.github/workflows/publish.yml`) then:

1. Runs `scripts/build_people.py` (materialises `docs/people/index.qmd` and
   copies member photos).
2. Runs `scripts/build_topics.py` (materialises `docs/_topics.qmd`).
3. Runs `quarto render docs`.
4. Force-pushes `docs/_site/` to the `gh-pages` branch.

GitHub Pages serves from `gh-pages` / `(root)`.

> **GitHub Pages settings**: in Settings → Pages, set source to
> **Branch: `gh-pages`** with folder **`/ (root)`** (not `/docs`).

## Local preview

```sh
pip install pyyaml          # one-time
python scripts/build_people.py
python scripts/build_topics.py
quarto preview docs
```

Quarto auto-reloads on file changes. If you edit something under `members/`
or `topics/`, re-run the corresponding build script.

## Adding content

- **A new member**: see [members/README.md](members/README.md).
- **A student topic**: see [topics/README.md](topics/README.md).
- **A publication**: append a BibTeX entry to
  [docs/publications/references.bib](docs/publications/references.bib), then
  switch the publications page front-matter to the bib-driven version (see the
  comment in [docs/publications/index.qmd](docs/publications/index.qmd)).
- **A research highlight**: create `docs/highlights/<slug>/index.qmd` with
  `title`, `subtitle`, `description`, `date` and `image` (the card thumbnail)
  in the front matter; the Highlights page and the landing page list it
  automatically. Put figures and any page-specific `css`/`resources` (e.g.,
  JavaScript for interactive figures) in the same folder. Reusable blocks
  (`.hl-numbers`, `.hl-cite`, `.hl-credit`) are styled in `custom.scss`; see
  `docs/highlights/rtip-antarctica/` for an example.
- **A research theme**: edit [docs/research.qmd](docs/research.qmd), or add a
  sub-page under `docs/research/` and link it from there.
- **Site colours / styling**: edit
  [docs/assets/css/custom.scss](docs/assets/css/custom.scss).
