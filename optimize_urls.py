import json
import re
import os
import urllib.request
import urllib.parse
import base64

GITHUB_REPO = 'carvalauto/carvalauto.github.io'
GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN', '')
BASE_API = f'https://api.github.com/repos/{GITHUB_REPO}'

BING_SITEMAP_URL = 'https://www.bing.com/ping?sitemap='
YANDEX_SITEMAP_URL = 'https://webmaster.yandex.com/services/sitemap.xml'

def api_request(path, method='GET', data=None):
    url = f'{BASE_API}/{path}'
    headers = {
        'User-Agent': 'Python-urllib/3.10',
        'Accept': 'application/vnd.github.v3+json'
    }
    if GITHUB_TOKEN:
        headers['Authorization'] = f'token {GITHUB_TOKEN}'
    req = urllib.request.Request(url, headers=headers, method=method)
    if data:
        req.data = json.dumps(data).encode()
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())

def notify_bing(sitemap_url):
    try:
        url = BING_SITEMAP_URL + urllib.parse.quote(sitemap_url)
        req = urllib.request.Request(url, headers={'User-Agent': 'Python-urllib/3.10'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status == 200
    except Exception:
        return False

def notify_yandex(sitemap_url):
    try:
        req = urllib.request.Request(YANDEX_SITEMAP_URL, headers={'User-Agent': 'Python-urllib/3.10'})
        data = json.dumps({'url': sitemap_url}).encode()
        req.data = data
        req.add_header('Content-Type', 'application/json')
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status == 200
    except Exception:
        return False

def fetch_products():
    url = 'https://api.github.com/repos/carvalauto/carvalauto.github.io/contents/products.json'
    req = urllib.request.Request(url, headers={'User-Agent': 'Python-urllib/3.10'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
        content = base64.b64decode(data['content']).decode()
        return json.loads(content)

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
        name = name[:55].rstrip('-')
    return name + '.html'

def extract_slug_from_url(url):
    path = url.split('/products/')[-1]
    path = path.replace('.html', '')
    parts = path.rsplit('-', 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0], parts[1]
    return path, None

def get_all_sitemap_urls():
    sitemap_file = 'sitemap_downloaded.xml'
    if os.path.exists(sitemap_file):
        with open(sitemap_file, 'r', encoding='utf-8') as f:
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
            # URL-encode spaces and commas in source path
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

    print('Next step: Run this script again with --batch to apply all changes.')

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

def batch_all():
    print('=== STEP 2: Batch Apply All URL Changes ===')
    print()

    redirects = generate_redirects()

    print(f'Total redirect rules: {len(redirects)}')
    print()

    existing = ''
    redirects_file = '_redirects'
    if os.path.exists(redirects_file):
        with open(redirects_file, 'r', encoding='utf-8') as f:
            existing = f.read()

    new_redirects = '\n'.join(redirects)
    updated_redirects = existing.rstrip('\n') + '\n\n# URL Optimization Redirects\n' + new_redirects

    with open(redirects_file, 'w', encoding='utf-8') as f:
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
    print()
    print('Notifying search engines...')
    bing_ok = notify_bing('https://carvalautopart.com/sitemap.xml')
    print(f'  Bing: {"OK" if bing_ok else "Failed"}')
    yandex_ok = notify_yandex('https://carvalautopart.com/sitemap.xml')
    print(f'  Yandex: {"OK" if yandex_ok else "Failed"}')

def main():
    import sys
    if '--batch' in sys.argv:
        batch_all()
    else:
        test_one()

if __name__ == '__main__':
    main()