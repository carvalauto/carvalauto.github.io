#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate sitemap.xml from the REAL files present in the local products/ directory.
The workflow checks out the whole repo first, so products/*.html (incl. ru/ subdir)
are real files -> every sitemap URL is guaranteed to resolve.
"""
import os
from datetime import datetime

BASE = 'https://carvalautopart.com'
PRODUCTS_DIR = 'products'

def collect_html_files(root):
    """Recursively collect .html files under root. Returns list of URL paths (no leading slash)."""
    files = []
    if not os.path.isdir(root):
        return files
    for dirpath, dirnames, filenames in os.walk(root):
        # skip hidden dirs
        dirnames[:] = [d for d in dirnames if not d.startswith('.')]
        for fn in sorted(filenames):
            if fn.endswith('.html'):
                rel = os.path.join(dirpath, fn).replace('\\', '/')
                files.append(rel)
    return files

today = datetime.now().strftime('%Y-%m-%d')

# Static pages (keep stable order)
static_urls = [
    ('https://carvalautopart.com/', 'daily', '1.0'),
    ('https://carvalautopart.com/products.html', 'daily', '0.9'),
    ('https://carvalautopart.com/index.html', 'weekly', '0.8'),
]

product_files = collect_html_files(PRODUCTS_DIR)
print('Real product HTML files found:', len(product_files))

lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
]

for loc, freq, prio in static_urls:
    lines.append('  <url>')
    lines.append('    <loc>' + loc + '</loc>')
    lines.append('    <lastmod>' + today + '</lastmod>')
    lines.append('    <changefreq>' + freq + '</changefreq>')
    lines.append('    <priority>' + prio + '</priority>')
    lines.append('  </url>')

for f in product_files:
    lines.append('  <url>')
    lines.append('    <loc>' + BASE + '/' + f + '</loc>')
    lines.append('    <lastmod>' + today + '</lastmod>')
    lines.append('    <changefreq>weekly</changefreq>')
    lines.append('    <priority>0.8</priority>')
    lines.append('  </url>')

lines.append('</urlset>')

with open('sitemap.xml', 'w') as f:
    f.write('\n'.join(lines))

print('Sitemap generated! ' + str(len(product_files)) + ' product pages + ' + str(len(static_urls)) + ' static')
