"""مطابقة كلمة (أو كلمات) داخل نص آية بعد التطبيع؛ تستعملها الدروس والبحث."""
import re

from .arabic import normalize

_TOKEN = re.compile(r"\S+")


def tokens(text: str) -> list[dict]:
    """كلمات الآية بمواقعها؛ علامات الوقف المنفصلة تُستبعد."""
    out = []
    for m in _TOKEN.finditer(text):
        a, b = normalize(m.group()), normalize(m.group(), spell_dagger=True)
        if a:
            out.append({"start": m.start(), "end": m.end(), "text": m.group(), "a": a, "b": b})
    return out


def find_word(text: str, word: str) -> tuple[int, int] | None:
    """موضع الكلمة (أو الكلمات المتتالية) داخل نص الآية، بالمقارنة بعد التطبيع."""
    if not word.strip():
        return None
    if word in text:  # الكلمة منسوخة من المصحف حرفياً؛ نمدّها إلى حدود الكلمة كاملة («ص» ← «صٓ»)
        i = text.index(word)
        j = i + len(word)
        while i > 0 and not text[i - 1].isspace():
            i -= 1
        while j < len(text) and not text[j].isspace():
            j += 1
        return i, j
    targets = [normalize(word).split(), normalize(word, spell_dagger=True).split()]
    # كلمتان في الإملاء قد تكونان كلمة واحدة في الرسم: «يا أيها» ← «يَٰٓأَيُّهَا»
    targets += [["".join(t)] for t in targets if len(t) > 1]
    toks = tokens(text)
    for target in targets:
        n = len(target)
        for i in range(len(toks) - n + 1):
            if all(target[j] in (toks[i + j]["a"], toks[i + j]["b"]) for j in range(n)):
                return toks[i]["start"], toks[i + n - 1]["end"]
    # الكلمة جزء من كلمة المصحف (مثل «من» داخل «وَمَن»)
    for target in targets:
        if len(target) == 1:
            for t in toks:
                if target[0] in t["a"] or target[0] in t["b"]:
                    return t["start"], t["end"]
    return None
