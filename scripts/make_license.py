"""يُصدر كود تفعيل الاشتراك (لوحة المعلّم) موقّعاً بمفتاح Ed25519 الخاص.

الاستعمال:
  python scripts/make_license.py --name "اسم المعلّم" --months 12
  python scripts/make_license.py --init      # إنشاء زوج المفاتيح أول مرة فقط

المفتاح الخاص في signing/license-private.key (لا يُرفع إلى GitHub). المفتاح العام في
frontend/src/lib/license.js؛ لو أُعيد إنشاء المفتاح الخاص بطلت كل الأكواد السابقة.
"""
import argparse
import base64
import datetime as dt
import json
import secrets
from pathlib import Path

from nacl.signing import SigningKey

ROOT = Path(__file__).resolve().parent.parent
KEY = ROOT / "signing" / "license-private.key"


def b64(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--init", action="store_true")
    ap.add_argument("--name", default="")
    ap.add_argument("--months", type=int, default=12)
    a = ap.parse_args()
    if a.init:
        if KEY.exists():
            raise SystemExit("المفتاح موجود؛ لن يُستبدل (ستبطل الأكواد القديمة).")
        sk = SigningKey.generate()
        KEY.write_bytes(bytes(sk))
        print("المفتاح العام (ضعه في license.js):", b64(bytes(sk.verify_key)))
        return
    sk = SigningKey(KEY.read_bytes())
    until = dt.date.today() + dt.timedelta(days=round(a.months * 30.44))
    payload = json.dumps({"p": "teacher", "e": until.isoformat(), "n": a.name, "i": secrets.token_hex(4)},
                         ensure_ascii=False, separators=(",", ":")).encode()
    print(f"TJW-{b64(payload)}.{b64(sk.sign(payload).signature)}")
    print("صالح حتى:", until.isoformat())


if __name__ == "__main__":
    main()
