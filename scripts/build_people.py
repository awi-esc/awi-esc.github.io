#!/usr/bin/env python3
"""Build the People page from members/<slug>/info.yml.

Reads each `members/<slug>/info.yml`, copies the corresponding photo into
`docs/assets/people/<slug>/`, and writes `docs/people/index.qmd`.

Both outputs are gitignored — CI runs this before `quarto render`.
"""
from __future__ import annotations

import shutil
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
MEMBERS_DIR = REPO_ROOT / "members"
DOCS_DIR = REPO_ROOT / "docs"
PEOPLE_PAGE = DOCS_DIR / "people" / "index.qmd"
PHOTOS_DIR = DOCS_DIR / "assets" / "people"

PHOTO_EXTS = ("jpg", "jpeg", "png", "webp")

LINK_SPECS = {
    "github":   ("bi-github",        "https://github.com/{}"),
    "orcid":    ("bi-person-vcard",  "https://orcid.org/{}"),
    "scholar":  ("bi-mortarboard",   "https://scholar.google.com/citations?user={}"),
    "website":  ("bi-globe",         "{}"),
    "email":    ("bi-envelope",      "mailto:{}"),
    "linkedin": ("bi-linkedin",      "https://linkedin.com/in/{}"),
    "bluesky":  ("bi-cloud",         "https://bsky.app/profile/{}"),
}


def load_members() -> list[dict]:
    members = []
    for folder in sorted(MEMBERS_DIR.iterdir()):
        if not folder.is_dir() or folder.name.startswith((".", "_")):
            continue
        info_file = folder / "info.yml"
        if not info_file.exists():
            print(f"  skip {folder.name}/ (no info.yml)")
            continue
        data = yaml.safe_load(info_file.read_text()) or {}
        if "name" not in data:
            print(f"  skip {folder.name}/ (info.yml missing 'name')")
            continue
        data["_slug"] = folder.name
        data["_folder"] = folder
        members.append(data)
    members.sort(key=lambda m: (m.get("order", 99), m["name"]))
    return members


def find_photo(member: dict) -> Path | None:
    folder = member["_folder"]
    declared = member.get("photo")
    if declared:
        candidate = folder / declared
        if candidate.exists():
            return candidate
    for ext in PHOTO_EXTS:
        candidate = folder / f"photo.{ext}"
        if candidate.exists():
            return candidate
    return None


def copy_photo(member: dict) -> str | None:
    src = find_photo(member)
    if src is None:
        return None
    slug = member["_slug"]
    dest_dir = PHOTOS_DIR / slug
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / src.name
    shutil.copy2(src, dest)
    return f"../assets/people/{slug}/{src.name}"


def render_links(links: dict | None) -> str:
    if not links:
        return ""
    parts = []
    for key, value in links.items():
        spec = LINK_SPECS.get(key)
        if spec is None:
            continue
        icon, url_fmt = spec
        url = url_fmt.format(value)
        parts.append(
            f'<a href="{url}" aria-label="{key}" title="{key}">'
            f'<i class="bi {icon}"></i></a>'
        )
    return f'<div class="links">{"".join(parts)}</div>' if parts else ""


def render_keywords(keywords: list[str] | None) -> str:
    if not keywords:
        return ""
    chips = "".join(f'<span class="kw">{k}</span>' for k in keywords)
    return f'<div class="keywords">{chips}</div>'


def initials(name: str) -> str:
    return "".join(part[0] for part in name.split()[:2]).upper()


def render_position(position) -> str:
    """`position` may be a plain string or {text, url}."""
    if isinstance(position, dict):
        text = position.get("text", "")
        url = position.get("url", "")
        if url and text:
            return f'<a href="{url}">{text}</a>'
        return text
    return position or ""


def year_of(date_str) -> str | None:
    """Extract the year from a YYYY-MM (or YYYY) string."""
    if not date_str:
        return None
    return str(date_str)[:4]


def render_dates(member: dict) -> str:
    start = year_of(member.get("start_date"))
    end = year_of(member.get("end_date"))
    if start and end:
        text = f"{start}–{end}"
    elif start:
        text = f"Since {start}"
    elif end:
        text = f"Until {end}"
    else:
        return ""
    return f'<div class="dates">{text}</div>'


def render_member(member: dict) -> str:
    photo_url = copy_photo(member)
    if photo_url:
        photo_html = f'<img src="{photo_url}" alt="{member["name"]}">'
    else:
        photo_html = f'<div class="photo-placeholder">{initials(member["name"])}</div>'

    return (
        '<div class="member-card">\n'
        f"{photo_html}\n"
        '<div class="meta">\n'
        f'<div class="name">{member["name"]}</div>\n'
        f'<div class="position">{render_position(member.get("position"))}</div>\n'
        f'{render_dates(member)}\n'
        f'<div class="bio">{member.get("bio", "")}</div>\n'
        f'{render_links(member.get("links"))}\n'
        f'{render_keywords(member.get("keywords"))}\n'
        "</div>\n"
        "</div>\n"
    )


def main() -> None:
    if PHOTOS_DIR.exists():
        shutil.rmtree(PHOTOS_DIR)

    members = load_members()
    current = [m for m in members if not m.get("end_date")]
    former = [m for m in members if m.get("end_date")]
    print(f"Found {len(current)} current and {len(former)} former member(s).")

    sections = []
    if current:
        sections.append("\n".join(render_member(m) for m in current))
    elif not former:
        sections.append("_No members yet._")
    if former:
        sections.append(
            "## Former members\n\n"
            + "\n".join(render_member(m) for m in former)
        )
    body = "\n\n".join(sections)

    page = (
        "---\n"
        'title: "People"\n'
        "page-layout: full\n"
        "---\n\n"
        "<!-- AUTO-GENERATED by scripts/build_people.py — do not edit manually. -->\n\n"
        f"{body}\n"
    )
    PEOPLE_PAGE.parent.mkdir(parents=True, exist_ok=True)
    PEOPLE_PAGE.write_text(page)
    print(f"Wrote {PEOPLE_PAGE.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
