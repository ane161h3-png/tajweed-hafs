"""دروس الأحكام: قراءة وتعديل وإضافة وحذف، مع نسخة احتياطية قبل كل تغيير.

المحتوى في data/content/ahkam.json. كل درس ورقة دفتر: التعريف لغةً واصطلاحاً، والحروف،
وطريقة الأداء، والأمثلة من القرآن، والاستثناءات، والأبيات، وجدول اختياري.
"""
from __future__ import annotations

import json
import os
import shutil
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from .db import ROOT
from .matching import find_word, tokens  # noqa: F401  (يستعملها المحرّر والاختبارات)

CONTENT_DIR = ROOT / "data" / "content"
MAX_BACKUPS = 50
_lock = threading.Lock()


def content_path() -> Path:
    return Path(os.environ.get("TAJWEED_CONTENT", CONTENT_DIR / "ahkam.json"))


class Example(BaseModel):
    surah: int = Field(ge=1, le=114)
    ayah: int = Field(ge=1, le=286)
    word: str = Field(default="", max_length=200)  # الكلمة كما في المصحف (أو بإملاء عادي)
    note: str = Field(default="", max_length=500)  # سبب الحكم: «النون الساكنة بعدها التاء»


class Verse(BaseModel):
    source: str = Field(default="", max_length=100)  # تحفة الأطفال، المقدمة الجزرية …
    first: str = Field(default="", max_length=300)  # الشطر الأول
    second: str = Field(default="", max_length=300)  # الشطر الثاني


class Table(BaseModel):
    caption: str = ""
    headers: list[str] = []
    rows: list[list[str]] = []


class LessonIn(BaseModel):
    section: str = Field(pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=200)
    order: int = 0
    status: Literal["draft", "reviewed"] = "draft"
    lugha: str = ""  # التعريف لغةً
    istilah: str = ""  # التعريف اصطلاحاً
    letters: str = ""  # الحروف
    method: str = ""  # طريقة الأداء
    examples: list[Example] = []
    exceptions: str = ""  # الاستثناءات
    notes: str = ""  # فوائد وتنبيهات
    verses: list[Verse] = []
    table: Table | None = None
    rules: list[str] = []  # معرّفات أحكام المصحف لزر «اعرض مواضع هذا الحكم»

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        return v.strip()


class Lesson(LessonIn):
    id: str
    updated_at: str = ""


# ---------- التخزين ----------

def _empty() -> dict:
    return {"version": 1, "riwaya": "حفص عن عاصم من طريق الشاطبية", "lessons": []}


def load() -> dict:
    path = content_path()
    if not path.exists():
        return _empty()
    return json.loads(path.read_text(encoding="utf-8"))


def _save(data: dict) -> None:
    path = content_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        backups = path.parent / "backups"
        backups.mkdir(exist_ok=True)
        stamp = datetime.now().strftime("%Y%m%d-%H%M%S-%f")
        shutil.copy2(path, backups / f"{path.stem}-{stamp}.json")
        for old in sorted(backups.glob(f"{path.stem}-*.json"))[:-MAX_BACKUPS]:
            old.unlink()
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _new_id(section: str, existing: set[str]) -> str:
    n = 1
    while f"{section}-{n}" in existing:
        n += 1
    return f"{section}-{n}"


def summaries() -> list[dict]:
    keys = ("id", "section", "order", "title", "status", "updated_at")
    lessons = sorted(load()["lessons"], key=lambda x: (x["section"], x.get("order", 0), x["id"]))
    return [{k: x.get(k) for k in keys} | {"examples": len(x.get("examples", [])), "rules": x.get("rules", [])}
            for x in lessons]


def get(lesson_id: str) -> dict | None:
    return next((x for x in load()["lessons"] if x["id"] == lesson_id), None)


def create(data: LessonIn) -> dict:
    with _lock:
        store = load()
        ids = {x["id"] for x in store["lessons"]}
        if not data.order:
            data.order = 1 + max((x.get("order", 0) for x in store["lessons"] if x["section"] == data.section), default=0)
        lesson = Lesson(**data.model_dump(), id=_new_id(data.section, ids), updated_at=_now()).model_dump()
        store["lessons"].append(lesson)
        _save(store)
        return lesson


def update(lesson_id: str, data: LessonIn) -> dict | None:
    with _lock:
        store = load()
        for i, x in enumerate(store["lessons"]):
            if x["id"] == lesson_id:
                store["lessons"][i] = Lesson(**data.model_dump(), id=lesson_id, updated_at=_now()).model_dump()
                _save(store)
                return store["lessons"][i]
        return None


def delete(lesson_id: str) -> bool:
    with _lock:
        store = load()
        kept = [x for x in store["lessons"] if x["id"] != lesson_id]
        if len(kept) == len(store["lessons"]):
            return False
        store["lessons"] = kept
        _save(store)
        return True
