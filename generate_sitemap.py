import json
import re
from datetime import datetime

def clean_slug(text):
    text = text.lower().strip()
    text = re.sub(r'[^\x00-\x7f]', '', text)
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    text = text.strip('-')
    return text

def generate_slug(product_name, product_id):
    name = clean_slug(product_name)
    name = re.sub(r'\b(api|sn|sp|snsn|acea|cfa|gf|gb|gl|gl-5|dexron|mercon|atf|automatic|transmission|fluid|oil|lubricant|motor|gasoline|diesel|petroleum|base|additive|for|the|of|and|or|in|on|with|20000km|long|life|1l|4l|6l|12|bottles|case|workshop|bulk|pack|1q|1qt|1liter|5w|0w|10w|15w|20w|25w|30|40|50)\b', '', name)
    name = re.sub(r'-+', '-', name)
    name = name.strip('-')
    if len(name) > 55:
        name = name[:55]
        last_dash = name.rfind('-')
        if last_dash > 0:
            name = name[:last_dash]
        else:
            name = name[:50]
        name = name.rstrip('-')
    return name + '.html'

with open('products.json', 'r') as f:
    products = json.load(f)

today = datetime.now().strftime('%Y-%m-%d')

lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    '    <loc>https://carvalautopart.com/</loc>',
    '    <lastmod>' + today + '</lastmod>',
    '    <changefreq>daily</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '  <url>',
    '    <loc>https://carvalautopart.com/products.html</loc>',
    '    <lastmod>' + today + '</lastmod>',
    '    <changefreq>daily</changefreq>',
    '    <priority>0.9</priority>',
    '  </url>',
]

for i, p in enumerate(products):
    pid = p.get('id', str(i + 1))
    pname = p.get('name', p.get('title', f'Product {pid}'))
    slug = generate_slug(pname, pid)
    lines.append('  <url>')
    lines.append('    <loc>https://carvalautopart.com/products/' + slug + '</loc>')
    lines.append('    <lastmod>' + today + '</lastmod>')
    lines.append('    <changefreq>weekly</changefreq>', )
    lines.append('    <priority>0.8</priority>')
    lines.append('  </url>')

lines.append('</urlset>')

with open('sitemap.xml', 'w') as f:
    f.write('\n'.join(lines))

print('Sitemap generated! ' + str(len(products)) + ' products')