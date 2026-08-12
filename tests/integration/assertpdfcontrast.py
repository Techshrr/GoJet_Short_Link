#!/usr/bin/env python3
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/gojet-pdf-acceptance/invoice-pixels.ppm')
with path.open('rb') as handle:
    if handle.readline().strip() != b'P6':
        raise SystemExit('PDF contrast input is not P6 PPM')
    tokens = []
    while len(tokens) < 3:
        line = handle.readline()
        if not line:
            raise SystemExit('truncated PPM header')
        tokens.extend(line.split(b'#', 1)[0].split())
    width, height, maxval = map(int, tokens[:3])
    pixels = handle.read()

if (width, height) != (595, 842) or maxval != 255:
    raise SystemExit(f'unexpected PDF raster geometry {width}x{height} max={maxval}')
if len(pixels) != width * height * 3:
    raise SystemExit('truncated PDF raster data')

def dark(y0, y1, threshold=160):
    total = 0
    for y in range(y0, y1):
        row = pixels[y * width * 3:(y + 1) * width * 3]
        for i in range(0, len(row), 3):
            if max(row[i], row[i + 1], row[i + 2]) < threshold:
                total += 1
    return total

body = dark(250, 500)
footer = dark(700, 842)
if body < 500:
    raise SystemExit(f'invoice details/amount lack readable contrast: dark_pixels={body}')
if footer < 50:
    raise SystemExit(f'invoice footer lacks readable contrast: dark_pixels={footer}')
print(f'PDF visual contrast acceptance: body_dark={body}, footer_dark={footer}')
