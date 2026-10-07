#!/usr/bin/env python3
"""One-off migration of the Hugo content tree into Astro content collections.

Each article becomes one folder holding both editions and its images:

    src/content/posts/<slug>/zh.md
    src/content/posts/<slug>/en.md
    src/content/posts/<slug>/<image>.png

Hugo shortcodes are rewritten into portable Markdown so the same source can be
served to agents as-is:

    lead     -> front matter `lead`
    alert    -> GitHub alert blockquote (> [!NOTE] ...)
    figure   -> ![alt](./file.png "caption")
    mermaid  -> ```mermaid fenced block
    demo     -> ```html demo height=.. caption=".." fenced block
    button   -> plain Markdown link
    {{</* x */>}} (escaped examples) -> literal {{< x >}}

Run from the repository root: python3 scripts/migrate-from-hugo.py
Images are moved with `git mv` so their history follows them.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "content"
DEST = ROOT / "src" / "content"

ALERT_KIND = {
    "circle-info": "NOTE",
    "circle-question": "NOTE",
    "lightbulb": "TIP",
    "triangle-exclamation": "WARNING",
    "bomb": "CAUTION",
}

problems: list[str] = []


def split_front_matter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    _, fm, body = text.split("---", 2)
    return yaml.safe_load(fm) or {}, body.lstrip("\n")


def params(raw: str) -> dict[str, str]:
    return {k: v for k, v in re.findall(r'(\w+)="((?:[^"\\]|\\.)*)"', raw)}


def quote_block(inner: str) -> str:
    lines = inner.strip("\n").split("\n")
    return "\n".join(("> " + ln) if ln.strip() else ">" for ln in lines)


def convert_body(body: str, slug: str, images: set[str], where: str) -> tuple[str, str | None]:
    lead = None

    m = re.search(r"\{\{<\s*lead\s*>\}\}\s*\n?(.*?)\n?\{\{<\s*/lead\s*>\}\}\s*", body, re.S)
    if m:
        lead = " ".join(m.group(1).split())
        if re.search(r"[*_`\[<]", lead):
            problems.append(f"{where}: lead contains inline markup: {lead[:60]}")
        body = body[: m.start()] + body[m.end():]

    def alert(m: re.Match) -> str:
        icon = params(m.group(1)).get("icon", "circle-info")
        kind = ALERT_KIND.get(icon)
        if not kind:
            problems.append(f"{where}: unknown alert icon {icon}")
            kind = "NOTE"
        return f"> [!{kind}]\n" + quote_block(m.group(2))

    body = re.sub(r"\{\{<\s*alert\b([^>]*)>\}\}(.*?)\{\{<\s*/alert\s*>\}\}", alert, body, flags=re.S)

    def figure(m: re.Match) -> str:
        p = params(m.group(1))
        src = p.get("src", "")
        prefix = f"/images/posts/{slug}/"
        if not src.startswith(prefix):
            problems.append(f"{where}: figure outside its post folder: {src}")
            return m.group(0)
        name = src[len(prefix):]
        images.add(name)
        alt = p.get("alt", "").replace("]", "\\]")
        caption = p.get("caption", "").replace('"', "&quot;")
        return f'![{alt}](./{name} "{caption}")' if caption else f"![{alt}](./{name})"

    body = re.sub(r"\{\{<\s*figure\b(.*?)>\}\}", figure, body, flags=re.S)

    body = re.sub(r"\{\{<\s*mermaid\s*>\}\}\s*\n(.*?)\n?\{\{<\s*/mermaid\s*>\}\}",
                  lambda m: "```mermaid\n" + m.group(1).strip("\n") + "\n```", body, flags=re.S)

    def demo(m: re.Match) -> str:
        p = params(m.group(1))
        meta = f'demo height={p.get("height", "280")}'
        if p.get("caption"):
            meta += f' caption="{p["caption"]}"'
        return f"```html {meta}\n" + m.group(2).strip("\n") + "\n```"

    body = re.sub(r"\{\{[<%]\s*demo\b([^>%]*)[>%]\}\}\s*\n(.*?)\n?\{\{[<%]\s*/demo\s*[>%]\}\}", demo, body, flags=re.S)

    def button(m: re.Match) -> str:
        return f"[{m.group(2).strip()}]({params(m.group(1)).get('href', '')})"

    body = re.sub(r"\{\{<\s*button\b([^>]*)>\}\}(.*?)\{\{<\s*/button\s*>\}\}", button, body, flags=re.S)

    body = body.replace("{{</*", "{{<").replace("*/>}}", ">}}")

    left = re.findall(r"\{\{[<%].*?[>%]\}\}", body)
    # literal examples inside fenced code are fine; report everything else
    for sc in left:
        problems.append(f"{where}: shortcode left in body: {sc[:60]}")
    return body.strip() + "\n", lead


def as_list(v) -> list[str]:
    if v is None:
        return []
    return [str(x) for x in (v if isinstance(v, list) else [v])]


def post_front_matter(fm: dict, lead: str | None) -> dict:
    out: dict = {"title": fm["title"], "description": fm.get("description") or fm.get("summary", "")}
    out["date"] = fm["date"]
    if fm.get("lastmod"):
        out["updated"] = fm["lastmod"]
    if lead:
        out["lead"] = lead
    out["tags"] = as_list(fm.get("tags"))
    out["categories"] = as_list(fm.get("categories"))
    if fm.get("series"):
        out["series"] = as_list(fm["series"])[0]
        out["seriesOrder"] = int(fm.get("series_order", 0))
    if fm.get("aliases"):
        out["aliases"] = as_list(fm["aliases"])
    if fm.get("draft"):
        out["draft"] = True
    return out


def dump(fm: dict, body: str) -> str:
    text = yaml.safe_dump(fm, allow_unicode=True, sort_keys=False, width=1000)
    return f"---\n{text}---\n\n{body}"


def migrate_posts() -> None:
    for zh_file in sorted((SRC / "posts").glob("*.md")):
        if zh_file.name.startswith("_"):
            continue
        slug = zh_file.stem
        en_file = SRC / "en" / "posts" / zh_file.name
        if not en_file.exists():
            problems.append(f"posts/{slug}: missing English edition")
            continue
        folder = DEST / "posts" / slug
        folder.mkdir(parents=True, exist_ok=True)
        images: set[str] = set()
        for lang, f in (("zh", zh_file), ("en", en_file)):
            fm, body = split_front_matter(f.read_text(encoding="utf-8"))
            body, lead = convert_body(body, slug, images, f"{lang}/{slug}")
            (folder / f"{lang}.md").write_text(dump(post_front_matter(fm, lead), body), encoding="utf-8")
        for name in sorted(images):
            src = ROOT / "static" / "images" / "posts" / slug / name
            dst = folder / name
            if dst.exists():
                continue
            if not src.exists():
                problems.append(f"posts/{slug}: image not found {name}")
                continue
            subprocess.run(["git", "mv", str(src), str(dst)], cwd=ROOT, check=True)


def migrate_simple(kind: str, files: dict[str, tuple[Path, Path]]) -> None:
    for slug, (zh_file, en_file) in files.items():
        folder = DEST / kind / slug
        folder.mkdir(parents=True, exist_ok=True)
        for lang, f in (("zh", zh_file), ("en", en_file)):
            fm, body = split_front_matter(f.read_text(encoding="utf-8"))
            body, lead = convert_body(body, slug, set(), f"{lang}/{kind}/{slug}")
            out = {"title": fm["title"], "description": fm.get("description") or fm.get("summary", "")}
            if fm.get("date"):
                out["date"] = fm["date"]
            if lead:
                out["lead"] = lead
            (folder / f"{lang}.md").write_text(dump(out, body), encoding="utf-8")


def main() -> int:
    migrate_posts()
    migrate_simple("projects", {
        s: (SRC / "projects" / f"{s}.md", SRC / "en" / "projects" / f"{s}.md") for s in ("vane", "argus")
    })
    migrate_simple("pages", {"privacy": (SRC / "privacy.md", SRC / "en" / "privacy.md")})
    for p in problems:
        print("WARN", p)
    print(f"done, {len(problems)} warnings")
    return 0


if __name__ == "__main__":
    sys.exit(main())
