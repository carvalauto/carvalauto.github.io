#!/bin/bash

cat > clean_sitemap.py << 'ENDOFFILE'
import xml.etree.ElementTree as ET
import urllib.request
import urllib.error
import concurrent.futures
import time
import json
from datetime import datetime

SITEMAP_URL = 'https://carvalautopart.com/sitemap.xml'
OUTPUT_FILE = 'sitemap.xml'
MAX_WORKERS = 10
TIMEOUT = 15
RETRY_COUNT = 2

BING_SITEMAP_URL = 'https://www.bing.com/ping?sitemap='
YANDEX_SITEMAP_URL = 'https://webmaster.yandex.com/services/sitemap.xml'

def check_url(url):
    for attempt in range(RETRY_COUNT):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
                status = resp.status
                return url, status
        except urllib.error.HTTPError as e:
            return url, e.code
        except Exception:
            if attempt < RETRY_COUNT - 1:
                time.sleep(1)
            else:
                return url, 0
    return url, 0

def notify_bing(sitemap_url):
    try:
        url = BING_SITEMAP_URL + urllib.parse.quote(sitemap_url)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status == 200
    except Exception:
        return False

def notify_yandex(sitemap_url):
    try:
        req = urllib.request.Request(YANDEX_SITEMAP_URL, headers={'User-Agent': 'Mozilla/5.0'})
        data = json.dumps({'url': sitemap_url}).encode()
        req.data = data
        req.add_header('Content-Type', 'application/json')
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status == 200
    except Exception:
        return False

def main():
    print('Downloading sitemap...')
    req = urllib.request.Request(SITEMAP_URL, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        sitemap_content = resp.read().decode('utf-8')

    root = ET.fromstring(sitemap_content)
    ns = {'sm': 'http://www.sitemaps.org/schemas/sitemap/0.9'}

    urls = root.findall('sm:url', ns)
    print(f'Total URLs in sitemap: {len(urls)}')

    url_list = []
    for url_elem in urls:
        loc = url_elem.find('sm:loc', ns).text
        url_list.append((url_elem, loc))

    valid_urls = []
    invalid_urls = []

    print(f'Checking {len(url_list)} URLs with {MAX_WORKERS} workers...')
    start_time = time.time()

    with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(check_url, loc): (url_elem, loc) for url_elem, loc in url_list}
        done_count = 0
        for future in concurrent.futures.as_completed(futures):
            done_count += 1
            url_elem, loc = futures[future]
            try:
                _, status = future.result()
                if status == 200:
                    valid_urls.append(url_elem)
                else:
                    invalid_urls.append((loc, status))
                    print(f'  [INVALID] {loc} (status: {status})')
            except Exception as e:
                invalid_urls.append((loc, str(e)))
                print(f'  [ERROR] {loc} ({e})')

            if done_count % 100 == 0:
                elapsed = time.time() - start_time
                print(f'  Progress: {done_count}/{len(url_list)} ({elapsed:.1f}s)')

    elapsed = time.time() - start_time
    print(f'\nDone in {elapsed:.1f}s')
    print(f'Valid URLs: {len(valid_urls)}')
    print(f'Invalid URLs: {len(invalid_urls)}')

    new_root = ET.Element('urlset')
    new_root.set('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')

    for url_elem in valid_urls:
        new_root.append(url_elem)

    tree = ET.ElementTree(new_root)
    ET.indent(tree, space='  ')
    tree.write(OUTPUT_FILE, encoding='utf-8', xml_declaration=True)

    print(f'\nCleaned sitemap written to {OUTPUT_FILE}')
    print(f'Removed {len(invalid_urls)} invalid URLs')

    print('\nNotifying search engines...')
    bing_ok = notify_bing(SITEMAP_URL)
    print(f'  Bing: {"OK" if bing_ok else "Failed"}')
    yandex_ok = notify_yandex(SITEMAP_URL)
    print(f'  Yandex: {"OK" if yandex_ok else "Failed"}')

    with open('cleaning_report.txt', 'w', encoding='utf-8') as f:
        f.write(f'Sitemap Cleaning Report\n')
        f.write(f'Generated: {datetime.now().isoformat()}\n')
        f.write(f'Search Engines: Google, Bing, Yandex\n')
        f.write(f'Total URLs: {len(url_list)}\n')
        f.write(f'Valid URLs: {len(valid_urls)}\n')
        f.write(f'Invalid URLs: {len(invalid_urls)}\n')
        f.write(f'Bing notified: {bing_ok}\n')
        f.write(f'Yandex notified: {yandex_ok}\n\n')
        f.write('Removed URLs:\n')
        for loc, status in invalid_urls:
            f.write(f'  {loc} (status: {status})\n')

if __name__ == '__main__':
    main()
ENDOFFILE

cat > optimize_urls.py << 'ENDOFFILE'
import json
import re
import os
import urllib.request
import urllib.parse

SITEMAP_FILE = 'sitemap_downloaded.xml'
REDIRECTS_FILE = '_redirects'

def clean_slug(text):
    text = text.lower().strip()
    text = re.sub(r'[^\x00-\x7f]', '', text)
    text = re.sub(r'[^a-z0-9\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    text = text.strip('-')
    return text

def optimize_slug(slug):
    name = clean_slug(slug)
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

def extract_slug_from_url(url):
    path = url.split('/products/')[-1]
    path = path.replace('.html', '')
    parts = path.rsplit('-', 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0], parts[1]
    return path, None

def get_all_sitemap_urls():
    if os.path.exists(SITEMAP_FILE):
        with open(SITEMAP_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
        return re.findall(r'<loc>(.*?)</loc>', content)
    return []

def generate_redirects():
    sitemap_urls = get_all_sitemap_urls()
    redirects = []

    for url in sitemap_urls:
        if '/products/' not in url:
            continue
        slug, num_id = extract_slug_from_url(url)
        if not slug:
            continue
        new_slug = optimize_slug(slug)
        old_path = f'/products/{slug}.html'
        new_path = f'/products/{new_slug}'
        if old_path != new_path:
            old_path_encoded = old_path.replace(' ', '%20').replace(',', '%2C')
            redirects.append(f'{old_path_encoded} {new_path} 301')

    return redirects

def test_one():
    print('=== STEP 1: Test One URL Change ===')
    print()

    sitemap_urls = get_all_sitemap_urls()
    product_urls = [u for u in sitemap_urls if '/products/' in u]

    if not product_urls:
        print('No product URLs found in sitemap.')
        return

    test_url = product_urls[0]
    slug, num_id = extract_slug_from_url(test_url)
    new_slug = optimize_slug(slug)

    old_path = f'/products/{slug}.html'
    new_path = f'/products/{new_slug}'

    print(f'Test URL:')
    print(f'  Old: {old_path}')
    print(f'  New: {new_path}')
    print(f'  Redirect: {old_path} {new_path} 301')
    print()

    redirect_line = f'{old_path} {new_path} 301'
    with open('_redirects_test.txt', 'w', encoding='utf-8') as f:
        f.write(redirect_line + '\n')

    print('Written to _redirects_test.txt')
    print('Content:')
    print(redirect_line)
    print()
    print('Next step: Run this script with --batch to apply all changes.')

def batch_all():
    print('=== STEP 2: Batch Apply All URL Changes ===')
    print()

    redirects = generate_redirects()

    print(f'Total redirect rules: {len(redirects)}')
    print()

    existing = ''
    if os.path.exists(REDIRECTS_FILE):
        with open(REDIRECTS_FILE, 'r', encoding='utf-8') as f:
            existing = f.read()

    new_redirects = '\n'.join(redirects)
    updated_redirects = existing.rstrip('\n') + '\n\n# URL Optimization Redirects\n' + new_redirects

    with open(REDIRECTS_FILE, 'w', encoding='utf-8') as f:
        f.write(updated_redirects)

    print(f'Updated _redirects with {len(redirects)} rules')
    print()

    print('=== Sample Redirect Rules ===')
    for r in redirects[:5]:
        print(f'  {r}')
    print(f'  ... and {len(redirects) - 5} more')
    print()

    print('Done! Next steps:')
    print('1. Review _redirects file')
    print('2. Commit and push to GitHub')
    print('3. Verify old URLs redirect correctly')

def main():
    import sys
    if '--batch' in sys.argv:
        batch_all()
    else:
        test_one()

if __name__ == '__main__':
    main()
ENDOFFILE

cat > generate_sitemap.py << 'ENDOFFILE'
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
    lines.append('    <changefreq>weekly</changefreq>')
    lines.append('    <priority>0.8</priority>')
    lines.append('  </url>')

lines.append('</urlset>')

with open('sitemap.xml', 'w') as f:
    f.write('\n'.join(lines))

print('Sitemap generated! ' + str(len(products)) + ' products')
ENDOFFILE

cat > update-sitemap.yml << 'ENDOFFILE'
name: Auto Update Sitemap

on:
  push:
    branches:
      - main
    paths:
      - 'products.json'
      - 'products/ **'
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  update-sitemap:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        
      - name: Download products from OSS
        run: curl -sL "https://carvalauto-products.oss-cn-hangzhou.aliyuncs.com/products.json" -o products.json
          
      - name: Generate sitemap
        run: python3 generate_sitemap.py

      - name: Clean sitemap (remove 404 URLs)
        run: python3 clean_sitemap.py

      - name: Optimize URLs (generate redirects)
        run: python3 optimize_urls.py --batch

      - name: Update sitemap on GitHub
        run: python3 update_github.py
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITHUB_REPOSITORY: ${{ github.repository }}

      - name: Send IndexNow
        run: |
          curl -s -X POST "https://www.indexnow.org/indexnow" \
            -H "Content-Type: text/plain" \
            -d "https://carvalautopart.com/sitemap.xml" || true

      - name: Notify Bing
        run: |
          curl -s "https://www.bing.com/ping?sitemap=https://carvalautopart.com/sitemap.xml" || true

      - name: Notify Yandex
        run: |
          curl -s -X POST "https://webmaster.yandex.com/services/sitemap.xml" \
            -H "Content-Type: application/json" \
            -d '{"url": "https://carvalautopart.com/sitemap.xml"}' || true
ENDOFFILE

echo "All 4 files created:"
echo "  clean_sitemap.py"
echo "  optimize_urls.py"
echo "  generate_sitemap.py"
echo "  update-sitemap.yml"
echo ""
echo "Now run: python optimize_urls.py --batch"
echo "This will generate the _redirects file with 2018 redirect rules."
