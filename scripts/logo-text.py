"""Outline text to an SVG path with fontTools (fonts are SIL OFL, so outlined logos are ours to use).
python3 scripts/logo-text.py <font.ttf> <wght> <text> <size> [tracking_em] -> JSON {d, w, asc}"""
import sys, json
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
path, wght, text, size = sys.argv[1], float(sys.argv[2]), sys.argv[3], float(sys.argv[4])
track = float(sys.argv[5]) if len(sys.argv) > 5 else 0
f = TTFont(path)
if 'fvar' in f: f = instancer.instantiateVariableFont(f, {'wght': wght}, inplace=False)
gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f['head'].unitsPerEm; s = size / upm
# pair kerning from the GPOS kern feature (PairPos format 1 and 2), best effort
kern = {}
try:
    for lk in f['GPOS'].table.LookupList.Lookup:
        for st in lk.SubTable:
            if getattr(st, 'ExtensionLookupType', None): st = st.ExtSubTable
            if getattr(st, 'LookupType', lk.LookupType) != 2 and lk.LookupType not in (2, 9): continue
            if not hasattr(st, 'Format'): continue
            if st.Format == 1:
                for i, g1 in enumerate(st.Coverage.glyphs):
                    for pv in st.PairSet[i].PairValueRecord:
                        v = pv.Value1; kern.setdefault((g1, pv.SecondGlyph), getattr(v, 'XAdvance', 0) or 0)
            elif st.Format == 2:
                c1 = st.ClassDef1.classDefs; c2 = st.ClassDef2.classDefs
                for g1 in st.Coverage.glyphs:
                    k1 = c1.get(g1, 0)
                    for g2 in [cmap[ord(ch)] for ch in text if ord(ch) in cmap]:
                        v = st.Class1Record[k1].Class2Record[c2.get(g2, 0)].Value1
                        x = getattr(v, 'XAdvance', 0) or 0
                        if x: kern.setdefault((g1, g2), x)
except Exception: pass
pen = SVGPathPen(gs); x = 0; asc = f['OS/2'].sCapHeight * s; prev = None
for ch in text:
    g = cmap[ord(ch)]
    if prev: x += kern.get((prev, g), 0) * s
    gs[g].draw(TransformPen(pen, (s, 0, 0, -s, x, 0)))
    x += gs[g].width * s + track * size; prev = g
print(json.dumps({'d': pen.getCommands(), 'w': round(x - track * size, 2), 'cap': round(asc, 2), 'x': round(f['OS/2'].sxHeight * s, 2)}))
