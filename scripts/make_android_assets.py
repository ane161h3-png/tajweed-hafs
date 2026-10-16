"""يولّد أيقونات التطبيق (أندرويد والويب/آيفون) وشاشة البداية لأندرويد من رسم الأيقونة، بلقطات من Chrome بلا واجهة.

التشغيل:  python scripts/make_android_assets.py [--chrome PATH]

يكتب فوق ملفات PNG الافتراضية في frontend/android/app/src/main/res بالمقاسات نفسها.
"""
from __future__ import annotations

import argparse
import os
import shutil
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RES = ROOT / "frontend" / "android" / "app" / "src" / "main" / "res"
PUBLIC = ROOT / "frontend" / "public"
# أيقونات الويب: (الملف، المقاس، النوع)
WEB_ICONS = [("icon-192.png", 192, "launcher"), ("icon-512.png", 512, "launcher"),
             ("icon-maskable-512.png", 512, "full"), ("apple-touch-icon.png", 180, "full")]
GREEN = "#1f6f5c"
PAPER = "#f7f4ec"
BOOK = ('<path d="M14 44c6-3 12-3 18 0 6-3 12-3 18 0V18c-6-3-12-3-18 0-6-3-12-3-18 0z" fill="none" '
        'stroke="{c}" stroke-width="3" stroke-linejoin="round"/><path d="M32 18v26" stroke="{c}" stroke-width="3"/>')
CHROME_GUESSES = [
    os.environ.get("CHROME_PATH", ""),
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"E:\hf-tmp\home\.cache\hyperframes\chrome\chrome-headless-shell\win64-152.0.7977.30\chrome-headless-shell-win64\chrome-headless-shell.exe",
]


def size_of(png: Path) -> tuple[int, int]:
    with open(png, "rb") as f:
        f.read(16)
        return struct.unpack(">II", f.read(8))


def page(kind: str, w: int, h: int) -> str:
    if kind == "foreground":  # منطقة الأمان في الأيقونة المتكيّفة: الثلثان في الوسط
        body = f'<svg viewBox="0 0 64 64" width="{w}" height="{h}"><g transform="translate(16 16) scale(0.5)">{BOOK.format(c=PAPER)}</g></svg>'
        bg = "transparent"
    elif kind == "full":  # مربع ممتلئ (آيفون يدوّر الحواف بنفسه، والأيقونة المتكيّفة تقصّها)
        body = (f'<div style="width:{w}px;height:{h}px;background:{GREEN};display:grid;place-items:center">'
                f'<svg viewBox="0 0 64 64" width="{w * 0.62}" height="{h * 0.62}">{BOOK.format(c=PAPER)}</svg></div>')
        bg = GREEN
    elif kind in ("launcher", "round"):
        radius = "50%" if kind == "round" else "22%"
        body = (f'<div style="width:{w}px;height:{h}px;border-radius:{radius};background:{GREEN};display:grid;place-items:center">'
                f'<svg viewBox="0 0 64 64" width="{w * 0.8}" height="{h * 0.8}">{BOOK.format(c=PAPER)}</svg></div>')
        bg = "transparent"
    else:  # splash
        s = min(w, h) * 0.24
        body = (f'<div style="width:{w}px;height:{h}px;display:grid;place-items:center;align-content:center;gap:{s * 0.18}px">'
                f'<div style="width:{s}px;height:{s}px;border-radius:22%;background:{GREEN};display:grid;place-items:center">'
                f'<svg viewBox="0 0 64 64" width="{s * 0.8}" height="{s * 0.8}">{BOOK.format(c=PAPER)}</svg></div>'
                f'<div dir="rtl" style="font:600 {s * 0.2}px Tahoma,\'Segoe UI\',sans-serif;color:#1d2a2c">تعلّم التجويد</div></div>')
        bg = PAPER
    return f'<!doctype html><meta charset="utf-8"><style>html,body{{margin:0;background:{bg};overflow:hidden}}</style>{body}'


def shoot(chrome: str, html: str, out: Path, w: int, h: int, tmp: Path) -> None:
    src = tmp / "p.html"
    src.write_text(html, encoding="utf-8")
    shot = tmp / "s.png"
    shot.unlink(missing_ok=True)
    subprocess.run([chrome, "--headless", "--disable-gpu", "--hide-scrollbars", f"--window-size={w},{h}",
                    "--default-background-color=00000000", f"--user-data-dir={tmp / 'profile'}",
                    f"--screenshot={shot}", src.as_uri()], check=True, capture_output=True, timeout=60)
    shutil.copyfile(shot, out)


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--chrome")
    args = p.parse_args(argv)
    chrome = next((c for c in [args.chrome, *CHROME_GUESSES] if c and Path(c).exists()), None)
    if not chrome:
        print("لم يُعثر على Chrome؛ مرّر مساره بـ --chrome", file=sys.stderr)
        return 1
    targets = [(PUBLIC / name, kind, size) for name, size, kind in WEB_ICONS]
    for png in sorted(RES.glob("*/*.png")):
        kind = {"ic_launcher.png": "launcher", "ic_launcher_round.png": "round",
                "ic_launcher_foreground.png": "foreground", "splash.png": "splash"}.get(png.name)
        if kind:
            targets.append((png, kind, None))
    with tempfile.TemporaryDirectory(dir=os.environ.get("TEMP")) as t:
        tmp = Path(t)
        for png, kind, fixed in targets:
            w, h = (fixed, fixed) if fixed else size_of(png)
            shoot(chrome, page(kind, w, h), png, w, h, tmp)
            assert size_of(png) == (w, h), f"مقاس غير صحيح: {png}"
    if (RES / "values").exists():
        (RES / "values" / "ic_launcher_background.xml").write_text(
            '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#1F6F5C</color>\n</resources>\n',
            encoding="utf-8")
    print(f"كُتبت {len(targets)} صورة في {RES}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
