import json
from datetime import datetime

with open('products.json', 'r') as f:
    products = json.load(f)

today = datetime.now().strftime('%Y-%m-%d')

lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    '    <loc>https://carvalautopart.com/</loc>',
    f'    <lastmod>{today}</lastmod>',
    '    <changefreq>daily</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '  <url>',
    '    <loc>https://carvalautopart.com/products.html</loc>',
    f'    <lastmod>{today}</lastmod>',
    '    <changefreq>daily</changefreq>',
    '    <priority>0.9</priority>',
    '  </url>',
]

for i, p in enumerate(products):
    pid = p.get('id', str(i + 1))
    lines.append('  <url>')
    lines.append(f'    <loc>https://carvalautopart.com/products/{pid}.html</loc>')
    lines.append(f'    <lastmod>{today}</lastmod>')
    lines.append('    <changefreq>weekly</changefreq>')
    lines.append('    <priority>0.8</priority>')
    lines.append('  </url>')

lines.append('</urlset>')

with open('sitemap.xml', 'w') as f:
    f.write('\n'.join(lines))

print(f"生成完成! {len(products)} 个产品")
