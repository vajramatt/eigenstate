# SPDX-License-Identifier: MIT
# Outlines the OpenGraph card's words from the bundled fonts into scripts/og-text.json.
# Pango on macOS renders through CoreText and ignores bundled font files, so build-og.mjs
# draws these paths instead of <text>; the card then renders the same on every machine.
# Run only when the card's words change:
#   python3 -m venv .venv && .venv/bin/pip install fonttools brotli uharfbuzz
#   .venv/bin/python scripts/og-text.py
import io, json
from pathlib import Path
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / 'src/assets/fonts'
# id: (text, font file, variation, size px, tracking em)
RUNS = {
  'eyebrow': ('CROSSING INTO / TOOL 01', 'jetbrains-mono-latin-wght-normal.woff2', {'wght': 500}, 13, 0.24),
  'title': ('Eigenstate', 'fraunces-latin-opsz-normal.woff2', {'wght': 330, 'opsz': 144}, 96, -0.025),
  'lede': ('A persistent synthetic universe', 'fraunces-latin-opsz-italic.woff2', {'wght': 320, 'opsz': 36}, 34, -0.01),
  'tagline': ('BROWSER SCREENSAVER · LOCAL · EVOLVING', 'jetbrains-mono-latin-wght-normal.woff2', {'wght': 500}, 14, 0.18),
  'url': ('SCREENSAVER.CROSSINGINTO.AI', 'jetbrains-mono-latin-wght-normal.woff2', {'wght': 400}, 13, 0.16),
}

def instance(file, loc):
  font = TTFont(FONTS / file); font.flavor = None
  static = instantiateVariableFont(font, loc, updateFontNames=False)
  buf = io.BytesIO(); static.save(buf); data = buf.getvalue()
  return TTFont(io.BytesIO(data)), data

out = {}
for key, (text, file, loc, size, tracking) in RUNS.items():
  font, data = instance(file, loc)
  upem = font['head'].unitsPerEm
  hbfont = hb.Font(hb.Face(data))
  buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
  hb.shape(hbfont, buf, {'kern': True, 'liga': True})
  scale, glyphs, order = size / upem, font.getGlyphSet(), font.getGlyphOrder()
  pen, x = SVGPathPen(glyphs, ntos=lambda v: f'{v:.2f}'.rstrip('0').rstrip('.')), 0.0
  infos, positions = buf.glyph_infos, buf.glyph_positions
  for i, (info, pos) in enumerate(zip(infos, positions)):
    glyph = glyphs[order[info.codepoint]]
    glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x + pos.x_offset * scale, -pos.y_offset * scale)))
    x += pos.x_advance * scale + (tracking * size if i < len(infos) - 1 else 0)
  out[key] = {'d': pen.getCommands(), 'width': round(x, 2), 'size': size}

(ROOT / 'scripts/og-text.json').write_text(json.dumps(out, indent=1) + '\n')
print('scripts/og-text.json:', ', '.join(f'{k} {v["width"]}px' for k, v in out.items()))
