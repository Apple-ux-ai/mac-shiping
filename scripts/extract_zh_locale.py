#!/usr/bin/env python3
from __future__ import annotations

import argparse
import ast
import io
import json
import re
import tokenize
from collections.abc import Iterable
from pathlib import Path

HAN_RE = re.compile(r"[\u4e00-\u9fff]")
JSX_TEXT_RE = re.compile(r">\s*([^<>{}\n]*[\u4e00-\u9fff][^<>{}\n]*)\s*<")
PLACEHOLDER_RE = re.compile(r"\$\{\s*([^}]+?)\s*\}")
TAG_RE = re.compile(r"<[^>]+>")

DEFAULT_ROOTS = [
    "frontend/src",
    "backend",
    "更新/通用更新组件",
]

INCLUDE_EXTS = {".js", ".jsx", ".ts", ".tsx", ".py", ".html"}
EXCLUDE_PARTS = {
    "node_modules",
    "docs",
    "build",
    "build_temp",
    "dist",
    "final_build",
    "release",
    "__pycache__",
}

DROP_VALUES = {
    "中进行路由映射。",
    "并享受更多高级功能",
    "文件包含完整的 Data URL（例如：",
    "此组件位于",
    "生成的",
    "登录后即可保存您的个性设置",
    "请根据你的实际业务逻辑（如 PDF 处理、图像转换等）修改此文件，或创建新的组件并在",
    "⚡ {isConverting ? '转换中...' : '全部转换'}",
    "），您可以直接将其复制到代码中使用。",
}

CODE_PREFIXES = (
    "const ",
    "let ",
    "var ",
    "export ",
    "import ",
    "return ",
    "showAlert(",
)


def looks_like_code(text: str) -> bool:
    stripped = text.strip()
    if not stripped:
        return True
    if stripped.startswith("{"):
        if not re.match(r"^\{[A-Za-z_][A-Za-z0-9_.]*\}.*[\u4e00-\u9fff]", stripped):
            return True
    if stripped.startswith(CODE_PREFIXES):
        return True
    if stripped.startswith("}>") or stripped.startswith("} )"):
        return True
    if "=>" in stripped or "className=" in stripped or " onClick=" in stripped:
        return True
    if any(token in stripped for token in (";}", ") =>", "function ")):
        return True
    return False


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not text:
        return ""
    text = PLACEHOLDER_RE.sub(lambda m: "{{" + m.group(1).strip() + "}}", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def collect_variants(text: str) -> list[str]:
    raw = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not raw or not HAN_RE.search(raw) or looks_like_code(raw):
        return []
    variants = [raw]
    normalized = normalize_text(raw)
    if normalized and normalized != raw:
        variants.append(normalized)
    return variants


def extend_unique(target: list[str], values: Iterable[str]) -> None:
    for value in values:
        if value and value not in target:
            target.append(value)


def should_skip(path: Path) -> bool:
    if path.suffix not in INCLUDE_EXTS:
        return True
    return any(part in EXCLUDE_PARTS for part in path.parts)


def iter_source_files(base_dir: Path, roots: list[str]) -> list[Path]:
    files: list[Path] = []
    for root in roots:
        root_path = (base_dir / root).resolve()
        if not root_path.exists():
            continue
        for path in root_path.rglob("*"):
            if path.is_file() and not should_skip(path):
                files.append(path)
    return sorted(files)


def extract_python_strings(text: str) -> list[str]:
    strings: list[str] = []
    try:
        tokens = tokenize.generate_tokens(io.StringIO(text).readline)
        for token in tokens:
            if token.type != tokenize.STRING:
                continue
            raw = token.string
            lowered = raw.lower()
            prefix_len = 0
            while prefix_len < len(raw) and raw[prefix_len] in "rRbBuUfF":
                prefix_len += 1
            body = raw[prefix_len:]
            if body[:3] in {"'''", '"""'} and body.endswith(body[:3]):
                inner = body[3:-3]
                extend_unique(strings, extract_markup_lines(inner))
                continue
            quote = body[0] if body else ""
            if quote in {'"', "'"} and body.endswith(quote):
                inner = body[1:-1]
                extend_unique(strings, collect_variants(inner))
            try:
                value = ast.literal_eval(raw)
            except Exception:
                continue
            if isinstance(value, str) and HAN_RE.search(value):
                extend_unique(strings, collect_variants(value))
    except Exception:
        return strings
    return strings


def extract_js_like_strings(text: str) -> list[str]:
    strings: list[str] = []
    i = 0
    length = len(text)
    in_line_comment = False
    in_block_comment = False

    while i < length:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < length else ""

        if in_line_comment:
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue

        if in_block_comment:
            if ch == "*" and nxt == "/":
                in_block_comment = False
                i += 2
            else:
                i += 1
            continue

        if ch == "/" and nxt == "/":
            in_line_comment = True
            i += 2
            continue

        if ch == "/" and nxt == "*":
            in_block_comment = True
            i += 2
            continue

        if ch not in {'"', "'", '`'}:
            i += 1
            continue

        quote = ch
        i += 1
        buffer: list[str] = []
        while i < length:
            current = text[i]
            if current == "\\":
                if i + 1 < length:
                    buffer.append(current)
                    buffer.append(text[i + 1])
                    i += 2
                    continue
                buffer.append(current)
                i += 1
                continue
            if current == quote:
                i += 1
                break
            buffer.append(current)
            i += 1

        value = "".join(buffer)
        extend_unique(strings, collect_variants(value))

    return strings


def extract_jsx_text(text: str) -> list[str]:
    strings: list[str] = []
    for match in JSX_TEXT_RE.finditer(text):
        extend_unique(strings, collect_variants(match.group(1)))
    return strings


def extract_markup_lines(text: str) -> list[str]:
    strings: list[str] = []
    for raw_line in text.splitlines():
        if "<" not in raw_line and ">" not in raw_line:
            continue
        stripped = TAG_RE.sub("", raw_line)
        extend_unique(strings, collect_variants(stripped))
    return strings


def extract_strings(path: Path) -> list[str]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    if path.suffix == ".py":
        return extract_python_strings(text)
    return extract_js_like_strings(text) + extract_jsx_text(text) + extract_markup_lines(text)


def build_locale_map(base_dir: Path, roots: list[str]) -> dict[str, str]:
    locale_map: dict[str, str] = {}
    for path in iter_source_files(base_dir, roots):
        for value in extract_strings(path):
            if value in DROP_VALUES:
                continue
            locale_map.setdefault(value, value)
    return dict(sorted(locale_map.items(), key=lambda item: item[0]))


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract hardcoded Chinese strings into a locale JSON file.")
    parser.add_argument("--base-dir", default=".", help="Project base directory")
    parser.add_argument("--roots", default=",".join(DEFAULT_ROOTS), help="Comma-separated roots to scan")
    parser.add_argument("--output", required=True, help="Output locale JSON path")
    args = parser.parse_args()

    base_dir = Path(args.base_dir).resolve()
    roots = [item.strip() for item in args.roots.split(",") if item.strip()]
    output_path = Path(args.output).resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    locale_map = build_locale_map(base_dir, roots)
    output_path.write_text(json.dumps(locale_map, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"Extracted {len(locale_map)} unique Chinese strings")
    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
