import requests
from bs4 import BeautifulSoup
import json
import re

def test_url(url):
    print(f"Testing URL: {url}")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    try:
        response = requests.get(url, headers=headers, timeout=15)
        print(f"Status Code: {response.status_code}")
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 1. Try Open Graph tags
        og_title = soup.find('meta', property='og:title')
        og_image = soup.find('meta', property='og:image')
        og_desc = soup.find('meta', property='og:description')
        
        print(f"OG Title: {og_title['content'] if og_title else 'Not found'}")
        print(f"OG Image: {og_image['content'] if og_image else 'Not found'}")
        
        # 2. Try JSON-LD
        scripts = soup.find_all('script', type='application/ld+json')
        for script in scripts:
            try:
                data = json.loads(script.string)
                if isinstance(data, dict) and data.get('@type') == 'Product':
                    print("Found JSON-LD Product data")
                    print(f"Name: {data.get('name')}")
                    print(f"Image: {data.get('image')}")
                    break
            except:
                continue
                
        # 3. Try meta description for OEM
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc:
            content = meta_desc['content']
            print(f"Meta Description: {content[:100]}...")
            # Look for OEM patterns
            oem_match = re.search(r'OEM\s*(?:No\.?)?\s*:?\s*([A-Z0-9-]+)', content, re.I)
            if oem_match:
                print(f"Found OEM in meta: {oem_match.group(1)}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    # Use a real Alibaba product URL for testing
    test_url("https://www.alibaba.com/product-detail/High-Quality-Auto-Parts-Brake-Pad_1600123456789.html")
