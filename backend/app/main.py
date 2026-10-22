"""خادم برنامج التجويد.

التشغيل:  uvicorn app.main:app --reload --app-dir backend
"""
import json
import sqlite3

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import lessons as store
from .db import ROOT, db_path, get_conn
from .search import search as run_search

SOURCE_DIR = ROOT / "source-data"
CONTENT_DIR = ROOT / "data" / "content"  # ملفات الدروس والحروف والأسئلة (تُبنى في المراحل التالية)
DIST_DIR = ROOT / "frontend" / "dist"

app = FastAPI(title="برنامج التجويد", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    # Vite أثناء التطوير، وأصول Tauri/Capacitor عند التغليف لاحقاً
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "tauri://localhost", "capacitor://localhost"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)


def _ayah(row, with_surah: bool = False) -> dict:
    d = {"ayah": row["ayah"], "juz": row["juz"], "text": row["text"], "tajweed": json.loads(row["tajweed"])}
    if with_surah:
        d["surah"] = row["surah"]
    return d


def _bismillah_text(con) -> str | None:
    row = con.execute("SELECT value FROM meta WHERE key = 'bismillah_text'").fetchone()
    return row[0] if row else None


def _surah(row) -> dict:
    return {"number": row["number"], "name": row["name"], "name_en": row["name_en"],
            "ayah_count": row["ayah_count"], "revelation": row["revelation"], "bismillah": bool(row["bismillah"])}


def _read_content(name: str, default):
    path = CONTENT_DIR / name
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/api/health")
def health():
    path = db_path()
    if not path.exists():
        return {"db": False}
    con = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    meta = dict(con.execute("SELECT key, value FROM meta"))
    con.close()
    return {"db": True, "meta": meta}


@app.get("/api/surahs")
def surahs(con=Depends(get_conn)):
    rows = con.execute(
        "SELECT s.*, (SELECT juz FROM ayahs WHERE surah = s.number AND ayah = 1) AS juz "
        "FROM surahs s ORDER BY number").fetchall()
    return [{**_surah(r), "juz": r["juz"]} for r in rows]


@app.get("/api/surah/{n}")
def surah(n: int, con=Depends(get_conn)):
    row = con.execute("SELECT * FROM surahs WHERE number = ?", (n,)).fetchone()
    if not row:
        raise HTTPException(404, "لا توجد سورة بهذا الرقم (1–114)")
    ayahs = con.execute("SELECT * FROM ayahs WHERE surah = ? ORDER BY ayah", (n,)).fetchall()
    return {"surah": _surah(row), "bismillah_text": _bismillah_text(con) if row["bismillah"] else None,
            "ayahs": [_ayah(a) for a in ayahs]}


@app.get("/api/juz")
def juz_list(con=Depends(get_conn)):
    rows = con.execute("SELECT j.number, j.surah, j.ayah, s.name FROM juz j "
                       "LEFT JOIN surahs s ON s.number = j.surah ORDER BY j.number").fetchall()
    return [{"juz": r[0], "surah": r[1], "ayah": r[2], "surah_name": r[3]} for r in rows]


@app.get("/api/juz/{n}")
def juz(n: int, con=Depends(get_conn)):
    if not 1 <= n <= 30:
        raise HTTPException(404, "رقم الجزء من 1 إلى 30")
    ayahs = con.execute("SELECT * FROM ayahs WHERE juz = ? ORDER BY id", (n,)).fetchall()
    if not ayahs:
        raise HTTPException(404, "لا توجد آيات لهذا الجزء")
    numbers = sorted({a["surah"] for a in ayahs})
    marks = ",".join("?" * len(numbers))
    surah_rows = con.execute(f"SELECT * FROM surahs WHERE number IN ({marks}) ORDER BY number", numbers).fetchall()
    return {
        "juz": n,
        "start": {"surah": ayahs[0]["surah"], "ayah": ayahs[0]["ayah"]},
        "end": {"surah": ayahs[-1]["surah"], "ayah": ayahs[-1]["ayah"]},
        "surahs": [_surah(s) for s in surah_rows],
        "bismillah_text": _bismillah_text(con),
        "ayahs": [_ayah(a, with_surah=True) for a in ayahs],
    }


@app.get("/api/pages")
def pages_list(con=Depends(get_conn)):
    rows = con.execute("SELECT p.page, p.surah, p.ayah, s.name FROM pages p "
                       "LEFT JOIN surahs s ON s.number = p.surah ORDER BY p.page").fetchall()
    return [{"page": r[0], "surah": r[1], "ayah": r[2], "surah_name": r[3]} for r in rows]


@app.get("/api/page/{n}")
def page(n: int, con=Depends(get_conn)):
    """صفحة من مصحف المدينة (١–٦٠٤): آياتها بالشكل نفسه الذي يرجعه /api/juz/{n}."""
    if not 1 <= n <= 604:
        raise HTTPException(404, "رقم الصفحة من 1 إلى 604")
    start = con.execute("SELECT surah, ayah FROM pages WHERE page = ?", (n,)).fetchone()
    if start is None:
        raise HTTPException(404, "بيانات الصفحات غير متوفرة")
    nxt = con.execute("SELECT surah, ayah FROM pages WHERE page = ?", (n + 1,)).fetchone()
    lo = start["surah"] * 1000 + start["ayah"]
    hi = nxt["surah"] * 1000 + nxt["ayah"] if nxt else 10 ** 9
    ayahs = con.execute("SELECT * FROM ayahs WHERE surah * 1000 + ayah >= ? AND surah * 1000 + ayah < ? ORDER BY id",
                        (lo, hi)).fetchall()
    numbers = sorted({a["surah"] for a in ayahs})
    marks = ",".join("?" * len(numbers))
    surah_rows = con.execute(f"SELECT * FROM surahs WHERE number IN ({marks}) ORDER BY number", numbers).fetchall()
    return {
        "page": n,
        "start": {"surah": ayahs[0]["surah"], "ayah": ayahs[0]["ayah"]},
        "end": {"surah": ayahs[-1]["surah"], "ayah": ayahs[-1]["ayah"]},
        "surahs": [_surah(s) for s in surah_rows],
        "bismillah_text": _bismillah_text(con),
        "ayahs": [_ayah(a, with_surah=True) for a in ayahs],
    }


@app.get("/api/search")
def search(q: str = Query(..., min_length=1, max_length=200), limit: int = Query(20, ge=1, le=100),
           con=Depends(get_conn)):
    return run_search(con, q, limit)


@app.get("/api/rules")
def rules(con=Depends(get_conn)):
    rows = con.execute("SELECT * FROM rules").fetchall()
    firsts = {r[0]: {"surah": r[1] // 1000, "ayah": r[1] % 1000} for r in con.execute(
        "SELECT rule, MIN(surah * 1000 + ayah) FROM rule_ayahs GROUP BY rule")}
    return [{**json.loads(r["raw"]), "id": r["id"], "name": r["name"], "color": r["color"],
             "description": r["description"], "count": r["count"], "first": firsts.get(r["id"])} for r in rows]


@app.get("/api/rules/{rule_id}/surahs")
def rule_surahs(rule_id: str, con=Depends(get_conn)):
    """السور التي ورد فيها الحكم، مع عدد مواضعه وأول آية فيه في كل سورة."""
    if not con.execute("SELECT 1 FROM rules WHERE id = ?", (rule_id,)).fetchone():
        raise HTTPException(404, "حكم غير معروف")
    rows = con.execute(
        "SELECT r.surah, s.name, COUNT(*) AS ayahs, SUM(r.marks) AS marks, MIN(r.ayah) AS first_ayah "
        "FROM rule_ayahs r JOIN surahs s ON s.number = r.surah WHERE r.rule = ? GROUP BY r.surah ORDER BY r.surah",
        (rule_id,)).fetchall()
    return [{"surah": r[0], "name": r[1], "ayahs": r[2], "marks": r[3], "first_ayah": r[4]} for r in rows]


@app.get("/api/reciters")
def reciters():
    # يُقرأ مباشرة من المصدر: إضافة قارئ = سطر واحد في reciters.json بلا إعادة بناء
    path = SOURCE_DIR / "reciters.json"
    if not path.exists():
        raise HTTPException(503, "reciters.json غير موجود في source-data")
    return json.loads(path.read_text(encoding="utf-8-sig"))


@app.get("/api/minshawi")
def minshawi():
    path = SOURCE_DIR / "minshawi-library.json"
    if not path.exists():
        raise HTTPException(503, "minshawi-library.json غير موجود في source-data")
    return json.loads(path.read_text(encoding="utf-8-sig"))


@app.get("/api/ayah/{surah}/{ayah}")
def ayah(surah: int, ayah: int, con=Depends(get_conn)):
    """نص آية واحدة مع كلماتها؛ يستعمله محرّر الدروس لاختيار كلمة المثال بالضغط عليها."""
    row = con.execute("SELECT a.*, s.name AS surah_name FROM ayahs a JOIN surahs s ON s.number = a.surah "
                      "WHERE a.surah = ? AND a.ayah = ?", (surah, ayah)).fetchone()
    if not row:
        raise HTTPException(404, "لا توجد آية بهذا الرقم")
    return {"surah": surah, "ayah": ayah, "surah_name": row["surah_name"], "text": row["text"],
            "tajweed": json.loads(row["tajweed"]),
            "words": [{"start": t["start"], "end": t["end"], "text": t["text"]} for t in store.tokens(row["text"])]}


def _resolve_examples(lesson: dict, con) -> dict:
    """يضيف لكل مثال نص آيته وموضع الكلمة فيها، أو يعلّمه بأنه لم يُعثر عليه."""
    out = []
    for ex in lesson.get("examples", []):
        row = con.execute("SELECT a.text, s.name FROM ayahs a JOIN surahs s ON s.number = a.surah "
                          "WHERE a.surah = ? AND a.ayah = ?", (ex["surah"], ex["ayah"])).fetchone()
        match = store.find_word(row[0], ex.get("word", "")) if row else None
        out.append({**ex, "ayah_text": row[0] if row else None, "surah_name": row[1] if row else None,
                    "match": list(match) if match else None})
    return {**lesson, "examples": out}


@app.get("/api/lessons")
def lessons():
    data = store.load()
    return {"riwaya": data.get("riwaya"), "lessons": store.summaries()}


@app.get("/api/lessons/{lesson_id}")
def lesson(lesson_id: str, con=Depends(get_conn)):
    found = store.get(lesson_id)
    if found is None:
        raise HTTPException(404, "الدرس غير موجود")
    return _resolve_examples(found, con)


@app.post("/api/lessons", status_code=201)
def create_lesson(data: store.LessonIn):
    return store.create(data)


@app.put("/api/lessons/{lesson_id}")
def update_lesson(lesson_id: str, data: store.LessonIn, con=Depends(get_conn)):
    saved = store.update(lesson_id, data)
    if saved is None:
        raise HTTPException(404, "الدرس غير موجود")
    return _resolve_examples(saved, con)


@app.delete("/api/lessons/{lesson_id}", status_code=204)
def delete_lesson(lesson_id: str):
    if not store.delete(lesson_id):
        raise HTTPException(404, "الدرس غير موجود")


@app.get("/api/content/export")
def export_content():
    """نسخة كاملة من الدروس للحفظ أو النقل إلى جهاز آخر."""
    return FileResponse(store.content_path(), filename="ahkam.json", media_type="application/json")         if store.content_path().exists() else store.load()


@app.get("/api/letters")
def letters():
    return _read_content("letters.json", {"letters": [], "status": "تُبنى في المرحلة الرابعة"})


@app.get("/api/quiz")
def quiz(level: int | None = Query(None, ge=1, le=3)):
    data = _read_content("quiz.json", {"questions": [], "status": "تُبنى في المرحلة السادسة"})
    if level is not None:
        data = {**data, "questions": [q for q in data["questions"] if q.get("level") == level]}
    return data


# تشغيل نسخة الإنتاج من خادم واحد: الواجهة المبنية في frontend/dist
if DIST_DIR.exists():
    app.mount("/assets", StaticFiles(directory=DIST_DIR / "assets"), name="assets")

    @app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def spa(path: str):
        file = (DIST_DIR / path).resolve()
        if path and file.is_file() and DIST_DIR.resolve() in file.parents:
            media = "application/manifest+json" if file.suffix == ".webmanifest" else None
            # عامل الخدمة يجب ألا يُخزَّن مؤقتاً حتى يصل تحديثه فوراً
            headers = {"Cache-Control": "no-cache"} if file.name == "sw.js" else None
            return FileResponse(file, media_type=media, headers=headers)
        # ملف غير موجود (صوت، صورة…) أو مسار خادم: 404، لا صفحة التطبيق
        if path.startswith(("api/", "audio/")) or "." in path.rsplit("/", 1)[-1]:
            raise HTTPException(404, "مسار غير موجود")
        return FileResponse(DIST_DIR / "index.html", headers={"Cache-Control": "no-cache"})
