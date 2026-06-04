#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
# ─── How to run ───
# python3 scripts/check_readme_lesson_links.py

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
README_PATH = ROOT / "README.md"
PHASES_DIR = ROOT / "phases"

PHASE_DIR_RE = re.compile(r"^[0-9]{2}-[a-z0-9][a-z0-9-]*[a-z0-9]$")
LESSON_DIR_RE = re.compile(r"^[0-9]{2}-[a-z0-9][a-z0-9-]*[a-z0-9]$")
PHASE_HEADER_RE = re.compile(r"###\s+Phase\s+(\d+):\s+.+?`(\d+)\s+lessons?`")
DETAILS_HEADER_RE = re.compile(
    r"<summary>\s*<b>\s*(?:[^\w\s]+\s+)?Phase\s+(\d+)\s*[—\-:].*?"
    r"<code>(\d+)\s+(?:lessons?|projects?)</code>"
)
LESSON_ROW_RE = re.compile(r"^\|\s*(\d+)\s*\|")
LESSON_LINK_RE = re.compile(r"\[[^\]]+\]\((phases/[^)]+)\)")


@dataclass(frozen=True, slots=True)
class PhaseCount:
    phase: int
    declared: int
    rows: int


@dataclass(frozen=True, slots=True)
class ReadmeIndex:
    lesson_paths: frozenset[str]
    duplicate_paths: tuple[str, ...]
    phase_counts: tuple[PhaseCount, ...]


@dataclass(frozen=True, slots=True)
class Drift:
    missing_paths: tuple[str, ...]
    extra_paths: tuple[str, ...]
    duplicate_paths: tuple[str, ...]
    phase_counts: tuple[PhaseCount, ...]

    def ok(self) -> bool:
        return not (
            self.missing_paths
            or self.extra_paths
            or self.duplicate_paths
            or self.phase_counts
        )


def normalize_path(raw_path: str) -> str:
    return raw_path.strip().rstrip("/")


def lesson_dirs() -> frozenset[str]:
    paths: set[str] = set()
    for phase_dir in sorted(PHASES_DIR.iterdir()):
        if not phase_dir.is_dir() or not PHASE_DIR_RE.match(phase_dir.name):
            continue
        for lesson_dir in sorted(phase_dir.iterdir()):
            if lesson_dir.is_dir() and LESSON_DIR_RE.match(lesson_dir.name):
                paths.add(lesson_dir.relative_to(ROOT).as_posix())
    return frozenset(paths)


def parse_readme(text: str) -> ReadmeIndex:
    current_phase: int | None = None
    declared_counts: dict[int, int] = {}
    row_counts: dict[int, int] = {}
    lesson_paths: set[str] = set()
    duplicate_paths: list[str] = []

    for line in text.splitlines():
        phase_match = PHASE_HEADER_RE.search(line) or DETAILS_HEADER_RE.search(line)
        if phase_match:
            current_phase = int(phase_match.group(1))
            declared_counts[current_phase] = int(phase_match.group(2))
            row_counts.setdefault(current_phase, 0)
            continue

        if current_phase is None or not LESSON_ROW_RE.match(line):
            continue

        link_match = LESSON_LINK_RE.search(line)
        if not link_match:
            continue

        path = normalize_path(link_match.group(1))
        row_counts[current_phase] = row_counts.get(current_phase, 0) + 1
        if path in lesson_paths:
            duplicate_paths.append(path)
        lesson_paths.add(path)

    phase_counts = tuple(
        PhaseCount(phase=phase, declared=declared, rows=row_counts.get(phase, 0))
        for phase, declared in sorted(declared_counts.items())
        if declared != row_counts.get(phase, 0)
    )
    return ReadmeIndex(
        lesson_paths=frozenset(lesson_paths),
        duplicate_paths=tuple(sorted(duplicate_paths)),
        phase_counts=phase_counts,
    )


def find_drift(expected_paths: frozenset[str], readme_index: ReadmeIndex) -> Drift:
    return Drift(
        missing_paths=tuple(sorted(expected_paths - readme_index.lesson_paths)),
        extra_paths=tuple(sorted(readme_index.lesson_paths - expected_paths)),
        duplicate_paths=readme_index.duplicate_paths,
        phase_counts=readme_index.phase_counts,
    )


def render_report(drift: Drift) -> str:
    if drift.ok():
        return "README.md lesson links match lesson directories.\n"

    lines = ["README.md lesson-link drift detected.\n"]
    if drift.missing_paths:
        lines.append("Missing README lesson rows:\n")
        lines.extend(f"  - {path}\n" for path in drift.missing_paths)
    if drift.extra_paths:
        lines.append("README lesson rows without matching directories:\n")
        lines.extend(f"  - {path}\n" for path in drift.extra_paths)
    if drift.duplicate_paths:
        lines.append("Duplicate README lesson rows:\n")
        lines.extend(f"  - {path}\n" for path in drift.duplicate_paths)
    if drift.phase_counts:
        lines.append("Phase declaration count mismatches:\n")
        lines.extend(
            f"  - Phase {count.phase}: declared {count.declared}, rows {count.rows}\n"
            for count in drift.phase_counts
        )
    return "".join(lines)


def main() -> int:
    readme_text = README_PATH.read_text(encoding="utf-8")
    drift = find_drift(lesson_dirs(), parse_readme(readme_text))
    sys.stdout.write(render_report(drift))
    return 0 if drift.ok() else 1


if __name__ == "__main__":
    sys.exit(main())
