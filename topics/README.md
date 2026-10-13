# Student topics

This folder holds the BSc/MSc thesis topics listed on the
[For students](https://awi-esc.github.io/students.html) page. Each topic is
one YAML file.

## Adding a topic

1. Copy `_template.yml` to `topics/<topic-slug>.yml` (lowercase, hyphenated).
2. Fill in the fields (schema below).
3. Open a PR. Once merged and published, the page rebuilds automatically.

When a topic is taken or no longer offered, set `status: taken` (or delete the
file). Only `open` topics are shown.

## Schema

```yaml
title: Short descriptive title          # required
contact: your-member-slug               # required; one slug or a list [a-b, c-d]
level: [BSc, MSc]                       # BSc and/or MSc
keywords: [keyword1, keyword2]          # optional
status: open                            # open (default) | taken
description: >                          # required; Markdown, 3–5 sentences
  What the project is about, what the student will do, and which
  tools or data are involved.
```

`contact` must match a folder in `members/`. The name and email shown on the
card come from that member's `info.yml` (`links.email`), so keep your email
there. If no email is set, the name links to the People page.

## How it works

`scripts/build_topics.py` (run by CI) reads every `topics/*.yml` (skipping
files that start with `_`) and writes `docs/_topics.qmd`, which is included at
the bottom of `docs/students.qmd`. The build fails on an unknown contact or
level, so typos are caught before publishing.

To preview locally:

```sh
pip install pyyaml          # one-time
python scripts/build_people.py
python scripts/build_topics.py
quarto preview docs
```
