# Group members

This folder holds member profiles. Each member has their own subfolder; nothing
else in the website depends on the rest of the repo layout.

## Adding or updating your profile

1. Create a folder named with your slug (lowercase, hyphenated):
   `members/<your-slug>/`
2. Add `info.yml` with your details (schema below).
3. Add a square `photo.jpg` (or `.png` / `.webp`), at least ~200×200 px.
4. Open a PR. Once merged, the People page rebuilds automatically.

## `info.yml` schema

```yaml
name: Full Name              # required
position: Job title          # required
bio: One-sentence description.
photo: photo.jpg             # optional; auto-detected if omitted
order: 1                     # optional; lower = higher in list (default 99)
links:                       # all optional
  github: <username>
  orcid: 0000-0000-0000-0000
  scholar: <google-scholar-id>
  website: https://example.org
  email: name@example.org
  linkedin: <linkedin-handle>
  bluesky: <handle.bsky.social>
keywords: [topic1, topic2]   # optional
```

Use `order` to pin senior staff to the top; everyone else can be left at the
default and will sort alphabetically.

## How it works

`scripts/build_people.py` (run by CI) reads every `members/<slug>/info.yml`,
copies the photo into `docs/assets/people/<slug>/`, and generates
`docs/people/index.qmd`. Both outputs are gitignored — the source of truth for
the People page lives in this folder.

To preview locally before opening a PR:

```sh
pip install pyyaml          # one-time
python scripts/build_people.py
quarto preview docs
```
