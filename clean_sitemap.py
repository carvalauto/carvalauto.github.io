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