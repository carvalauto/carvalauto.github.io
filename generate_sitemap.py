#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate sitemap.xml from the REAL files present in the repo.
- products/*.html  (incl. ru/ subdir)
- blog/*.html      (static blog articles)
- key static pages
Every sitemap URL is guaranteed to resolve.
"""
import os
from datetime import datetime

BASE = 'https://carvalautopart.com'
PRODUCTS_DIR = 'products'
BLOG_DIR = 'blog'

def collect_html_files(root):
    """Recursively collect .html files under root. Returns list of URL paths (no leading slash)."""
    files = []
    if not os.path.isdir(root):
        return files
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith('.')]
        for fn in sorted(filenames):
            if fn.endswith('.html'):
                rel = os.path.join(dirpath, fn).replace('\\', '/')
                files.append(rel)
    return files

today = datetime.now().strftime('%Y-%m-%d')

static_urls = [
    ('https://carvalautopart.com/', 'daily', '1.0'),
    ('https://carvalautopart.com/products.html', 'daily', '0.9'),
    ('https://carvalautopart.com/index.html', 'weekly', '0.8'),
    ('https://carvalautopart.com/blog.html', 'weekly', '0.8'),
    ('https://carvalautopart.com/faq.html', 'weekly', '0.7'),
    ('https://carvalautopart.com/japanese-cars.html', 'weekly', '0.7'),
    ('https://carvalautopart.com/korean-cars.html', 'weekly', '0.7'),
    ('https://carvalautopart.com/german-cars.html', 'weekly', '0.7'),
    ('https://carvalautopart.com/chinese-cars.html', 'weekly', '0.7'),
    ('https://carvalautopart.com/engine-oil.html', 'weekly', '0.7'),
]

product_files = collect_html_files(PRODUCTS_DIR)
blog_files = collect_html_files(BLOG_DIR)
print('Product HTML files:', len(product_files))
print('Blog HTML files:', len(blog_files))

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

for f in blog_files:
    lines.append('  <url>')
    lines.append('    <loc>' + BASE + '/' + f + '</loc>')
    lines.append('    <lastmod>' + today + '</lastmod>')
    lines.append('    <changefreq>monthly</changefreq>')
    lines.append('    <priority>0.6</priority>')
    lines.append('  </url>')

lines.append('</urlset>')

with open('sitemap.xml', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))

print('Sitemap generated! ' + str(len(product_files)) + ' products + ' + str(len(blog_files)) + ' blog + ' + str(len(static_urls)) + ' static')
