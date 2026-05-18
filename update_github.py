import json
import base64
import os
import urllib.request

TOKEN = os.environ['GITHUB_TOKEN']
REPO = os.environ['GITHUB_REPOSITORY']
BASE_URL = f'https://api.github.com/repos/{REPO}'

with open('sitemap.xml', 'r') as f:
    sitemap = f.read()

req = urllib.request.Request(
    f'{BASE_URL}/contents/sitemap.xml',
    headers={'Authorization': f'token {TOKEN}'}
)
sha = None
try:
    with urllib.request.urlopen(req) as resp:
        sha = json.loads(resp.read()).get('sha')
except:
    pass

data = {
    'message': 'Auto-update sitemap.xml',
    'content': base64.b64encode(sitemap.encode()).decode(),
    'branch': 'main'
}
if sha:
    data['sha'] = sha

req = urllib.request.Request(
    f'{BASE_URL}/contents/sitemap.xml',
    data=json.dumps(data).encode(),
    headers={'Authorization': f'token {TOKEN}'},
    method='PUT'
)

with urllib.request.urlopen(req) as resp:
    result = json.loads(resp.read())
    if 'commit' in result:
        print('sitemap.xml 更新成功!')
    else:
        print('更新失败')
