"""يصدّر كل بيانات الخادم ملفات JSON ثابتة في frontend/public/data، ليعمل التطبيق بلا خادم ولا إنترنت.

التشغيل:  python scripts/export_static.py

يستدعي مسارات الخادم نفسها ويحفظ ردودها، فالبيانات في التطبيق مطابقة للخادم حرفاً بحرف.
ويضيف search-index.json: نص كل آية مع صيغتيه المطبّعتين للبحث داخل التطبيق.
"""
from __future__ import annotations

import json
import shutil
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient  # noqa: E402

from app.arabic import normalize  # noqa: E402
from app.db import db_path  # noqa: E402
from app.main import app  # noqa: E402

OUT = ROOT / "frontend" / "public" / "data"


def write(rel: str, data) -> int:
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    path.write_text(text, encoding="utf-8")
    return len(text.encode())


def main() -> int:
    if OUT.exists():
        shutil.rmtree(OUT)
    c = TestClient(app)

    def get(path):
        r = c.get(path)
        r.raise_for_status()
        return r.json()

    size = 0
    files = 0
    for name, path in [("surahs", "/api/surahs"), ("juz", "/api/juz"), ("pages", "/api/pages"), ("rules", "/api/rules"),
                       ("reciters", "/api/reciters"), ("minshawi", "/api/minshawi"), ("letters", "/api/letters"),
                       ("quiz", "/api/quiz"), ("lessons", "/api/lessons"), ("health", "/api/health")]:
        size += write(f"{name}.json", get(path))
        files += 1
    for n in range(1, 115):
        size += write(f"surah/{n}.json", get(f"/api/surah/{n}"))
        files += 1
    for n in range(1, 31):
        size += write(f"juz/{n}.json", get(f"/api/juz/{n}"))
        files += 1
    for r in get("/api/rules"):
        size += write(f"rules/{r['id']}/surahs.json", get(f"/api/rules/{r['id']}/surahs"))
        files += 1
    for lesson in get("/api/lessons")["lessons"]:
        size += write(f"lessons/{lesson['id']}.json", get(f"/api/lessons/{lesson['id']}"))
        files += 1

    con = sqlite3.connect(db_path())
    ayahs = [[s, a, j, t, normalize(t), normalize(t, spell_dagger=True)]
             for s, a, j, t in con.execute("SELECT surah, ayah, juz, text FROM ayahs ORDER BY id")]
    surahs = [list(r) for r in con.execute("SELECT number, name, name_norm, ayah_count, revelation FROM surahs ORDER BY number")]
    juz = [list(r) for r in con.execute("SELECT number, surah, ayah FROM juz ORDER BY number")]
    size += write("search-index.json", {"fields": ["surah", "ayah", "juz", "text", "a", "b"], "ayahs": ayahs,
                                        "surahs": surahs, "juz": juz})
    files += 1
    # قائمة كل الملفات: يستعملها زر «حفظ للعمل دون إنترنت» في نسخة الويب
    listing = sorted(str(x.relative_to(OUT)).replace("\\", "/") for x in OUT.rglob("*.json"))
    write("manifest.json", {"version": get("/api/health")["meta"].get("built_at"), "files": listing})
    print(f"صُدّر {files} ملفاً ({size / 1024 / 1024:.1f} م.ب) إلى {OUT}")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    raise SystemExit(main())
