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
position: Job title          # required (string, OR see "linked position" below)
bio: One-sentence description.
photo: photo.jpg             # optional; auto-detected if omitted
order: 1                     # optional; lower = higher in list (default 99)
start_date: 2018-09          # optional, YYYY-MM
end_date:   2025-06          # optional, YYYY-MM — sets former-member status
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

**Order**: use `order` to pin senior staff to the top; everyone else sorts
alphabetically.

**Dates** (both optional, format `YYYY-MM`):

- Both blank → no dates shown on the card (default).
- Only `start_date` → card shows "Since YYYY".
- `end_date` set → card moves to a **Former members** section at the bottom of
  the page and shows "YYYY–YYYY" (or just "Until YYYY" if no start).

**Linked position** — write `position` as a mapping when you want it to link
out (e.g. an alum's new job):

```yaml
position:
  text: Now Postdoc at Lab X
  url: https://lab-x.org
```

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
