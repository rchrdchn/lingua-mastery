"""Logo v3: simple flat marks, max 2 colors. Writes src/brand/v3/*.svg. python3 scripts/logo3.py"""
import json, re, subprocess
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.boundsPen import BoundsPen
G, W, INK = '#0f7a5c', '#ffffff', '#13201b'
OUT = 'src/brand/v3'
FONT = '/usr/share/fonts/truetype/sand-box/google/Outfit/Outfit-VariableFont_wght.ttf'
def r2(d): return re.sub(r'-?\d+\.\d+', lambda m: f'{float(m.group()):.2f}'.rstrip('0').rstrip('.'), d)
def text(t, size, wght=800, track=-0.015):
    o = json.loads(subprocess.check_output(['python3', 'scripts/logo-text.py', FONT, str(wght), t, str(size), str(track)]))
    o['d'] = r2(o['d']); return o
def svg(name, title, body, vb='0 0 64 64'):
    open(f'{OUT}/{name}.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"><title>Lingua Magna: {title}</title>\n{body}\n</svg>\n')
tile = f'<rect width="64" height="64" rx="14" fill="{G}"/>'

# A. Ultra-minimal monogram: one geometric L, the foot ends round (a hint of a tongue)
svg('l', 'L monogram', tile + f'\n<path d="M18 13h11.5v25.5H41a5.75 5.75 0 0 1 0 11.5H18Z" fill="{W}"/>')

# B. LM ligature: the L stem is also the first leg of the M, the L foot underlines it
svg('lm', 'LM ligature', tile + f'\n<path d="M17 47V17l15 16 15-16v30Z" fill="none" stroke="{W}" stroke-width="7.5" stroke-linejoin="miter" stroke-miterlimit="10"/>')

# C. Talking tongue: a speech bubble whose tail is a rounded tongue
svg('bubble-tongue', 'Talking tongue', tile + f'\n<g fill="{W}"><rect x="9" y="12" width="46" height="31" rx="15.5"/><rect x="15" y="30" width="15" height="23" rx="7.5"/></g>')

# D. Speech bubble with a knocked-out L
bl = f'<path d="M32 9a21 21 0 1 1-10.3 39.3L11 52.5l3.6-10.3A21 21 0 0 1 32 9Z" fill="{W}"/><path d="M25.5 19.5h7v14.5h9v6.5h-16Z" fill="{G}"/>'
svg('bubble-l', 'Bubble L', tile + '\n' + bl)

# E. Wordmark: Outfit ExtraBold, the dot of the i is a tiny speech bubble
size = 48
f = instancer.instantiateVariableFont(TTFont(FONT), {'wght': 800}, inplace=False)
gs = f.getGlyphSet(); s = size / f['head'].unitsPerEm
L = text('L', size, track=-0.015); before = text('L', size)  # advance of L incl. tracking
adv_L = gs['L'].width * s - 0.015 * size
bp = BoundsPen(gs); gs['dotlessi'].draw(bp); x0, y0, x1, y1 = bp.bounds
bi = BoundsPen(gs); gs['i'].draw(bi); _, _, _, iy1 = bi.bounds
rest = text('\u0131ngua Magna', size)
cx = adv_L + (x0 + x1) / 2 * s; stem = (x1 - x0) * s; r = stem * 0.72
xh = y1 * s; cy = -(xh + 0.09 * size + r)
dot = (f'<g fill="{G}"><circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}"/>'
       f'<path d="M{cx + .15*r:.2f} {cy + .95*r:.2f}L{cx + 1.15*r:.2f} {cy + 1.2*r:.2f}L{cx + .9*r:.2f} {cy + .2*r:.2f}Z"/></g>')
w = adv_L + rest['w']; pad = 4; top = cy - r - pad; desc = 0.22 * size
vb = f'{-pad} {top:.2f} {w + 2*pad:.2f} {-top + desc + pad:.2f}'
svg('wordmark', 'Wordmark', f'<path d="{L["d"]}" fill="{INK}"/><path d="{rest["d"]}" transform="translate({adv_L:.2f} 0)" fill="{INK}"/>{dot}', vb)
# its app icon: the bubble-dotted i... kept simple as a white Outfit "Lm" on green
lm = text('Lm', 30, track=-0.03)
svg('wordmark-icon', 'Wordmark icon', tile + f'\n<path d="{lm["d"]}" transform="translate({32 - lm["w"]/2:.2f} {32 + lm["cap"]/2:.2f})" fill="{W}"/>')
print(open(f'{OUT}/wordmark.svg').read()[:200])

# Name lettering for pairing with a mark (plain i, no bubble dot)
nm = text('Lingua Magna', 48)
vbn = f'-1 {-(nm["cap"] + 1.5):.2f} {nm["w"] + 2:.2f} {nm["cap"] + 0.22*48 + 2.5:.2f}'
svg('name', 'Name', f'<path d="{nm["d"]}" fill="{INK}"/>', vbn)
