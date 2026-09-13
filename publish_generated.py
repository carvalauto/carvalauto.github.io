#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Publish generated files (blog/*.html + sitemap.xml) back to the repo via GitHub API.
Used by the GitHub Action so new blog posts automatically get static pages + sitemap.
"""
import json
import base64
import os
import urllib.request
import glob

TOKEN = os.environ.get('GITHUB_TOKEN')
REPO = os.environ.get('GITHUB_REPOSITORY')
BASE_URL = 'https://api.github.com/repos/' + REPO


def put_file(path, content_bytes, message):
    # get current sha (if exists)
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
    files = sorted(glob.glob('blog/*.html'))
    ok = 0
    for f in files:
        fpath = f.replace('\\', '/')
        with open(f, 'rb') as fh:
            put_file(fpath, fh.read(), 'Auto-generate blog page: ' + fpath)
        ok += 1
    print('blog pages published:', ok)

    if os.path.exists('sitemap.xml'):
        with open('sitemap.xml', 'rb') as fh:
            put_file('sitemap.xml', fh.read(), 'Auto-update sitemap.xml')
        print('sitemap.xml published')


if __name__ == '__main__':
    main()
