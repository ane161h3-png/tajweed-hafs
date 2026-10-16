"""يولّد رسوم المخارج في frontend/src/assets/makharij/.

التشغيل:  python scripts/make_makharij_svg.py

- head-sagittal.svg: مقطع جانبي للرأس، كل عضو path مستقل له id، وأوضاع اللسان والشفتين في <defs>
  بنفس بنية المسار (ليتحرك الشكل بينها بسلاسة).
- lips-front.svg: منظر أمامي للشفتين لحروف الشفة.
- teeth.svg: الأسنان الاثنان والثلاثون بأسمائها (منظر علوي للفكّين ومنظر أمامي).

اقرأ frontend/src/assets/makharij/README.md قبل تعديل الرسوم يدوياً.
"""
from __future__ import annotations

import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "frontend" / "src" / "assets" / "makharij"


def f(n: float) -> str:
    return f"{n:.1f}".rstrip("0").rstrip(".")


# ---------------- اللسان ----------------
# كل وضع: الطرف t، الذلق b، الوسط m، الأقصى k، الجذر r
TONGUE_POSES = {
    "rest": ((318, 264), (300, 250), (270, 242), (238, 248), (210, 278)),
    "qaf": ((318, 266), (300, 254), (266, 240), (226, 226), (208, 276)),
    "kaf": ((318, 266), (300, 250), (268, 232), (240, 218), (210, 276)),
    "wasat": ((318, 262), (302, 238), (274, 216), (242, 232), (210, 276)),
    "dad": ((318, 262), (302, 242), (278, 226), (244, 234), (210, 276)),
    "lam": ((316, 240), (298, 238), (270, 238), (238, 246), (210, 278)),
    "noon": ((320, 242), (300, 238), (270, 240), (238, 246), (210, 278)),
    "ra": ((313, 239), (296, 236), (268, 238), (238, 246), (210, 278)),
    "nit": ((322, 242), (302, 236), (270, 240), (238, 246), (210, 278)),
    "nit-itbaq": ((322, 242), (302, 232), (272, 224), (240, 226), (210, 276)),
    "asal": ((328, 256), (308, 246), (274, 238), (238, 246), (210, 278)),
    "asal-itbaq": ((328, 256), (308, 240), (274, 222), (240, 226), (210, 276)),
    "lithah": ((337, 253), (316, 246), (276, 238), (238, 246), (210, 278)),
    "lithah-itbaq": ((337, 253), (316, 240), (276, 222), (240, 226), (210, 276)),
    "istila": ((318, 266), (300, 252), (268, 236), (232, 230), (208, 276)),
}


def tongue_path(pose) -> str:
    (tx, ty), (bx, by), (mx, my), (kx, ky), (rx, ry) = pose
    p = [
        f"M {f(tx)} {f(ty)}",
        f"C {f(tx - 8)} {f(ty - 6)} {f(bx + 10)} {f(by + 1)} {f(bx)} {f(by)}",
        f"C {f(bx - 14)} {f(by - 4)} {f(mx + 16)} {f(my)} {f(mx)} {f(my)}",
        f"C {f(mx - 18)} {f(my)} {f(kx + 12)} {f(ky - 6)} {f(kx)} {f(ky)}",
        f"C {f(kx - 14)} {f(ky + 6)} {f(rx + 4)} {f(ry - 20)} {f(rx)} {f(ry)}",
        f"C {f(rx - 3)} {f(ry + 16)} 214 314 232 318",
        "C 262 324 300 312 314 296",
        f"C 320 288 {f(tx + 2)} {f(ty + 14)} {f(tx)} {f(ty)} Z",
    ]
    return " ".join(p)


# ---------------- الشفتان (مقطع جانبي) ----------------
LIPS = {
    "upper-lip": {
        "rest": "M 338 226 C 352 226 364 236 362 252 C 356 254 346 252 340 250 Z",
        "closed": "M 338 226 C 352 226 364 238 364 256 C 356 258 346 258 340 257 Z",
        "round": "M 340 228 C 356 226 372 238 370 252 C 362 255 350 253 342 251 Z",
    },
    "lower-lip": {
        "rest": "M 338 262 C 350 258 362 260 366 268 C 364 280 354 286 340 284 Z",
        "closed": "M 338 258 C 350 257 362 257 366 262 C 364 278 354 286 340 284 Z",
        "fa": "M 330 258 C 340 252 352 254 358 262 C 358 276 350 284 336 284 Z",
        "round": "M 340 262 C 354 258 370 260 372 268 C 368 280 356 286 342 284 Z",
    },
}

# مواضع المخارج (للتظليل والنبض، ولأسئلة «حدّد المخرج على الرسم»)
SPOTS = {
    "jawf": (250, 230, 22), "aqsa-halq": (191, 322, 9), "wasat-halq": (193, 281, 9), "adna-halq": (197, 248, 9),
    "qaf": (222, 226, 8), "kaf": (238, 216, 8), "wasat-lisan": (275, 212, 9), "dad": (285, 222, 9),
    "lam": (316, 235, 6), "noon": (321, 240, 5), "ra": (311, 236, 5), "nit": (325, 238, 5),
    "asal": (331, 257, 6), "lithah": (337, 251, 6), "fa": (337, 259, 7), "shafatan": (362, 257, 8),
    "khayshum": (356, 207, 9),
}

# التسميات: (المعرّف، النص، x التسمية، y التسمية، x النقطة، y النقطة، الجهة)
LABELS = [
    ("nasal", "تجويف الأنف", 478, 120, 300, 196, "r"),
    ("khayshum", "الخيشوم", 478, 150, 356, 207, "r"),
    ("hard-palate", "الحنك الصلب", 478, 182, 285, 213, "r"),
    ("gum", "اللثة", 478, 212, 324, 233, "r"),
    ("upper-teeth", "الثنايا العليا", 478, 242, 335, 246, "r"),
    ("lips", "الشفتان", 478, 272, 363, 262, "r"),
    ("lower-teeth", "الثنايا السفلى", 478, 302, 331, 272, "r"),
    ("tongue-tip", "طرف اللسان", 478, 332, 318, 262, "r"),
    ("tongue-middle", "وسط اللسان", 478, 362, 272, 246, "r"),
    ("tongue-edge", "حافتا اللسان (على الجانبين)", 478, 392, 298, 258, "r"),
    ("jawf", "الجوف", -35, 110, 250, 230, "l"),
    ("soft-palate", "الحنك اللين", -35, 150, 214, 224, "l"),
    ("uvula", "اللهاة", -35, 185, 201, 250, "l"),
    ("tongue-back", "أقصى اللسان", -35, 215, 236, 250, "l"),
    ("halq-adna", "أدنى الحلق", -35, 248, 194, 248, "l"),
    ("halq-wasat", "وسط الحلق", -35, 283, 190, 281, "l"),
    ("halq-aqsa", "أقصى الحلق", -35, 320, 189, 320, "l"),
    ("larynx", "الحنجرة والوتران الصوتيان", -35, 362, 190, 356, "l"),
]

HEAD = (
    "M 95 440 C 80 360 40 300 50 230 C 60 120 130 55 215 52 C 300 50 345 100 348 150 "
    "C 349 165 352 172 358 180 C 372 198 386 210 380 218 C 376 224 362 224 352 224 "
    "L 340 226 L 338 286 C 352 292 356 312 338 330 C 310 336 290 340 280 360 L 275 440 Z"
)


def head_svg() -> str:
    tongue_defs = "\n    ".join(
        f'<path id="tongue--{name}" d="{tongue_path(p)}"/>' for name, p in TONGUE_POSES.items())
    lip_defs = "\n    ".join(
        f'<path id="{organ}--{pose}" d="{d}"/>' for organ, poses in LIPS.items() for pose, d in poses.items())
    vertebrae = "\n    ".join(
        f'<rect class="t-bone" x="118" y="{230 + i * 40}" width="40" height="32" rx="8"/>' for i in range(5))
    spots = "\n    ".join(f'<circle id="spot--{k}" class="spot" cx="{x}" cy="{y}" r="{r}"/>' for k, (x, y, r) in SPOTS.items())
    labels = []
    for lid, text, lx, ly, ax, ay, side in LABELS:
        tx = lx
        elbow = 400 if side == "r" else 80
        labels.append(
            f'<g id="label--{lid}" class="label"><polyline class="leader" points="{ax},{ay} {elbow},{ly} {tx + (-4 if side == "r" else 4)},{ly}"/>'
            f'<circle class="leader-dot" cx="{ax}" cy="{ay}" r="2"/>'
            f'<text x="{tx}" y="{ly + 4}" text-anchor="{"start" if side == "r" else "end"}">{text}</text></g>')
    labels_s = "\n    ".join(labels)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="-40 20 525 430" direction="rtl" role="img" aria-labelledby="mk-title">
  <title id="mk-title">مقطع جانبي لأعضاء النطق</title>
  <defs>
    <!-- أوضاع اللسان والشفتين: المكوّن يقرأ هذه المسارات ويحرّك الشكل بينها -->
    {tongue_defs}
    {lip_defs}
    <radialGradient id="g-skin" cx="0.6" cy="0.45" r="0.7"><stop offset="0" style="stop-color:var(--mk-skin-1)"/><stop offset="1" style="stop-color:var(--mk-skin-2)"/></radialGradient>
    <linearGradient id="g-muscle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--mk-muscle-1)"/><stop offset="1" style="stop-color:var(--mk-muscle-2)"/></linearGradient>
    <linearGradient id="g-mucosa" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--mk-mucosa-1)"/><stop offset="1" style="stop-color:var(--mk-mucosa-2)"/></linearGradient>
    <marker id="air-head" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" style="fill:var(--mk-air)"/></marker>
  </defs>

  <g id="anatomy">
    <path id="head" class="t-skin" d="{HEAD}"/>
    <g id="spine" opacity="0.55">
    {vertebrae}
    </g>
    <!-- التجاويف: الفم والحلق -->
    <path id="cavity" class="t-cavity" d="M 180 340 L 178 260 C 180 225 200 205 230 203 C 270 200 310 210 336 236 L 342 262 C 330 290 300 312 260 318 L 212 318 L 206 340 Z"/>
    <path id="nasal" class="t-cavity" d="M 222 204 C 240 186 290 180 330 182 C 350 184 362 196 366 212 C 346 214 330 208 300 206 C 270 204 245 206 222 212 Z"/>
    <path id="conchae" class="detail" d="M 250 198 C 270 190 300 190 320 194 M 258 204 C 280 198 306 199 330 202"/>
    <path id="khayshum" class="t-mucosa" d="M 340 200 C 352 196 364 204 368 214 C 360 216 350 214 342 210 Z"/>
    <path id="jawf" class="region" d="M 186 236 C 200 222 230 214 270 214 C 300 214 320 228 340 250 L 340 258 C 320 256 300 246 272 244 C 245 242 225 252 212 270 L 205 340 L 180 340 Z"/>
    <!-- الحلق بأقسامه الثلاثة -->
    <path id="halq-adna" class="region" d="M 186 234 C 194 232 204 236 210 240 L 208 262 L 182 262 Z"/>
    <path id="halq-wasat" class="region" d="M 182 262 L 208 262 L 206 300 L 178 300 Z"/>
    <path id="halq-aqsa" class="region" d="M 178 300 L 206 300 L 204 340 L 178 340 Z"/>
    <path id="larynx" class="t-mucosa" d="M 178 340 L 204 340 L 200 380 L 182 380 Z"/>
    <path id="vocal-folds" class="detail-strong" d="M 182 354 L 189 352 M 200 354 L 193 352"/>
    <path id="trachea" class="t-cavity" d="M 183 380 L 199 380 L 199 440 L 183 440 Z"/>
    <path id="epiglottis" class="t-mucosa" d="M 206 300 C 214 296 216 288 212 282 C 208 290 205 296 204 302 Z"/>
    <path id="mandible" class="t-bone" d="M 236 322 C 270 330 310 330 330 296 L 336 300 C 330 330 300 342 262 338 C 245 336 236 330 232 326 Z"/>
    <!-- الحنك -->
    <path id="hard-palate" class="t-bone" d="M 326 238 C 322 222 300 210 262 207 L 225 210 L 225 218 C 260 215 298 220 316 238 Z"/>
    <path id="soft-palate" class="t-mucosa" d="M 225 210 C 210 212 200 222 196 236 C 194 246 198 254 203 252 C 208 248 212 236 225 218 Z"/>
    <path id="uvula" class="t-mucosa" d="M 198 244 C 196 250 199 256 203 253 C 205 250 203 246 201 243 Z"/>
    <path id="molars" class="molars" d="M 250 214 L 300 220 L 300 230 L 250 226 Z"/>
    <!-- اللسان: يتحرك بين الأوضاع المعرّفة في defs -->
    <path id="tongue" class="t-muscle" d="{tongue_path(TONGUE_POSES["rest"])}"/>
    <!-- الأسنان واللثة -->
    <path id="gum" class="t-mucosa" d="M 316 238 C 318 228 328 224 334 232 C 334 238 328 240 320 240 Z"/>
    <path id="upper-teeth" class="t-tooth" d="M 324 230 C 332 230 338 240 339 255 L 333 256 C 331 246 327 238 322 236 Z"/>
    <path id="lower-gum" class="t-mucosa" d="M 320 290 C 324 280 332 280 338 292 Z"/>
    <path id="lower-teeth" class="t-tooth" d="M 330 286 C 334 276 336 266 335 258 L 329 259 C 329 268 326 276 324 286 Z"/>
    <!-- الشفتان -->
    <path id="upper-lip" class="t-lip" d="{LIPS["upper-lip"]["rest"]}"/>
    <path id="lower-lip" class="t-lip" d="{LIPS["lower-lip"]["rest"]}"/>
  </g>

  <!-- مسارا الهواء: من الحنجرة إلى الفم، ومن الحلق إلى الأنف -->
  <path id="air--oral" class="air" marker-end="url(#air-head)" d="M 191 420 L 191 330 C 191 290 192 256 205 238 C 222 222 250 226 280 228 C 306 230 330 244 346 256 L 400 258"/>
  <path id="air--nasal" class="air" marker-end="url(#air-head)" d="M 190 300 C 190 250 196 222 214 206 C 240 194 290 192 330 198 C 352 202 368 210 392 214"/>

  <g id="spots">
    {spots}
  </g>
  <g id="labels">
    {labels_s}
  </g>
</svg>
'''


# ---------------- الشفتان: منظر أمامي ----------------
def lips_front_svg() -> str:
    poses = {
        "rest": ("M 40 70 C 70 52 130 52 160 70 C 130 74 70 74 40 70 Z", "M 40 74 C 70 78 130 78 160 74 C 130 100 70 100 40 74 Z", 6),
        "closed": ("M 40 72 C 70 54 130 54 160 72 C 130 75 70 75 40 72 Z", "M 40 72 C 70 75 130 75 160 72 C 130 98 70 98 40 72 Z", 0),
        "fa": ("M 40 66 C 70 48 130 48 160 66 C 130 68 70 68 40 66 Z", "M 46 82 C 72 74 128 74 154 82 C 128 102 72 102 46 82 Z", 10),
        "round": ("M 70 66 C 85 50 115 50 130 66 C 118 64 82 64 70 66 Z", "M 70 82 C 82 84 118 84 130 82 C 115 100 85 100 70 82 Z", 14),
    }
    defs = []
    for name, (up, low, gap) in poses.items():
        defs.append(f'<path id="lips-upper--{name}" d="{up}"/>')
        defs.append(f'<path id="lips-lower--{name}" d="{low}"/>')
    up, low, _ = poses["rest"]
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 20 200 110" direction="rtl" role="img" aria-labelledby="lf-title">
  <title id="lf-title">منظر أمامي للشفتين</title>
  <defs>
    {"\n    ".join(defs)}
  </defs>
  <ellipse id="face-lower" class="t-skin" cx="100" cy="78" rx="96" ry="54"/>
  <rect id="mouth-inside" class="t-cavity" x="54" y="64" width="92" height="22" rx="11"/>
  <path id="front-upper-teeth" class="t-tooth" d="M 76 64 L 124 64 L 122 76 C 112 79 88 79 78 76 Z"/>
  <path id="front-upper-teeth-lines" class="detail" d="M 88 64 L 88 77 M 100 64 L 100 78 M 112 64 L 112 77"/>
  <path id="lips-upper" class="t-lip" d="{up}"/>
  <path id="lips-lower" class="t-lip" d="{low}"/>
</svg>
'''


# ---------------- الأسنان ----------------
TOOTH_ORDER = ["thanaya", "rubaiyat", "anyab", "dawahik", "tawahin", "tawahin", "tawahin", "nawajidh"]


def teeth_svg() -> str:
    parts = []
    for jaw, cy, sign in (("upper", 150, -1), ("lower", 330, 1)):
        for side in (1, -1):
            for i, kind in enumerate(TOOTH_ORDER):
                # قوس على شكل U: الثنايا في المقدمة (أعلى القوس العلوي/أسفل القوس السفلي)
                ang = math.radians(8 + i * 22)
                x = 250 + side * 120 * math.sin(ang)
                y = cy + sign * (-110 * math.cos(ang) + 20)
                w = 13 + (i >= 4) * 9 + (i == 2) * 1
                h = 15 + (i >= 4) * 7
                rot = math.degrees(ang) * side * (-sign)
                parts.append(
                    f'<rect id="tooth-{jaw}-{"r" if side > 0 else "l"}{i + 1}" class="tooth t-tooth" data-kind="{kind}" '
                    f'x="{f(x - w / 2)}" y="{f(y - h / 2)}" width="{f(w)}" height="{f(h)}" rx="{f(min(w, h) / 2.4)}" '
                    f'transform="rotate({f(rot)} {f(x)} {f(y)})"/>')
    parts_s = "\n    ".join(parts)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="80 20 340 440" direction="rtl" role="img" aria-labelledby="th-title">
  <title id="th-title">الأسنان الاثنان والثلاثون: الفك العلوي والفك السفلي</title>
  <text class="jaw-label" x="250" y="44" text-anchor="middle">الفك العلوي (منظر من أسفل)</text>
  <text class="jaw-label" x="250" y="452" text-anchor="middle">الفك السفلي (منظر من أعلى)</text>
  <path class="t-mucosa" opacity="0.5" d="M 120 170 C 120 40 380 40 380 170 L 350 170 C 350 80 150 80 150 170 Z"/>
  <path class="t-mucosa" opacity="0.5" d="M 120 310 C 120 440 380 440 380 310 L 350 310 C 350 400 150 400 150 310 Z"/>
  <g id="teeth">
    {parts_s}
  </g>
</svg>
'''


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "head-sagittal.svg").write_text(head_svg(), encoding="utf-8")
    (OUT / "lips-front.svg").write_text(lips_front_svg(), encoding="utf-8")
    (OUT / "teeth.svg").write_text(teeth_svg(), encoding="utf-8")
    print("كُتبت الرسوم في", OUT)


if __name__ == "__main__":
    main()
