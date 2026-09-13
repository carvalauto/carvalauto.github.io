import json
import base64
import os
import glob
import urllib.request

TOKEN = os.environ.get('GITHUB_TOKEN')
REPO = os.environ.get('GITHUB_REPOSITORY')
BASE_URL = 'https://api.github.com/repos/' + REPO


def put_file(path, content_bytes, message):
    """Create or update a file in the repo via GitHub API."""
    # get current sha (if file exists)
    sha = None
    try:
        req = urllib.request.Request(
            BASE_URL + '/contents/' + path,
            headers={'Authorization': 'token ' + TOKEN}
        )
        with urllib.request.urlopen(req) as resp:
            sha = json.loads(resp.read()).get('sha')
    except Exception:
        sha = None

    data = {
        'message': message,
        'content': base64.b64encode(content_bytes).decode(),
        'branch': 'main'
    }
    if sha:
        data['sha'] = sha

    req = urllib.request.Request(
        BASE_URL + '/contents/' + path,
        data=json.dumps(data).encode(),
        headers={'Authorization': 'token ' + TOKEN},
        method='PUT'
    )
    with urllib.request.urlopen(req) as resp:
        return resp.status


def main():
    # 1) commit all generated blog pages
    blog_files = sorted(glob.glob('blog/*.html'))
    for f in blog_files:
        fpath = f.replace('\\', '/')
        try:
            with open(f, 'rb') as fh:
                put_file(fpath, fh.read(), 'Auto-generate blog page: ' + fpath)
        except Exception as e:
            print('blog page failed:', fpath, e)
    print('blog pages committed:', len(blog_files))

    # 2) commit sitemap
    if os.path.exists('sitemap.xml'):
        with open('sitemap.xml', 'rb') as fh:
            put_file('sitemap.xml', fh.read(), 'Auto-update sitemap.xml')
        print('sitemap.xml updated')


if __name__ == '__main__':
    main()
