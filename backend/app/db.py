import os
import sqlite3
from pathlib import Path

from fastapi import HTTPException

ROOT = Path(__file__).resolve().parents[2]


def db_path() -> Path:
    return Path(os.environ.get("TAJWEED_DB", ROOT / "data" / "tajweed.db"))


def get_conn():
    """اتصال للقراءة فقط لكل طلب."""
    path = db_path()
    if not path.exists():
        raise HTTPException(503, "قاعدة البيانات غير مبنية بعد. شغّل: python scripts/build_db.py")
    con = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True, check_same_thread=False)
    con.row_factory = sqlite3.Row
    try:
        yield con
    finally:
        con.close()
