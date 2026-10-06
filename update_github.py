#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Publish generated files (blog + parts + brands + sitemap) back to the repo.
Used by the GitHub Action. Primary: single git commit. Fallback: GitHub API.
"""
import os
import glob
import subprocess
import json
import base64
import urllib.request


def sh(*args):
    return subprocess.run(args, capture_output=True, text=True)


def publish_via_api():
    TOKEN = os.environ.get('GITHUB_TOKEN')
    REPO = os.environ.get('GITHUB_REPOSITORY')
    if not TOKEN or not REPO:
        print('no token/repo for API fallback')
        return
    BASE = 'https://api.github.com/repos/' + REPO

    def put_file(path, content_bytes, message):
        sha = None
        try:
            req = urllib.request.Request(BASE + '/contents/' + path, headers={'Authorization': 'token ' + TOKEN})
            with urllib.request.urlopen(req) as resp:
                sha = json.loads(resp.read()).get('sha')
        except Exception:
            sha = None
        data = {'message': message, 'content': base64.b64encode(content_bytes).decode(), 'branch': 'main'}
        if sha:
            data['sha'] = sha
        req = urllib.request.Request(BASE + '/contents/' + path, data=json.dumps(data).encode(),
                                     headers={'Authorization': 'token ' + TOKEN}, method='PUT')
        with urllib.request.urlopen(req) as resp:
            return resp.status

    files = sorted(glob.glob('blog/*.html')) + sorted(glob.glob('parts/**/*.html', recursive=True)) + sorted(glob.glob('brands/**/*.html', recursive=True))
    for f in ['parts.html', 'brands.html', 'vehicles.html', 'american-cars.html', 'european-cars.html']:
        if os.path.exists(f):
            files.append(f)
    ok = 0
    for f in files:
        fpath = f.replace('\\', '/')
        with open(f, 'rb') as fh:
            try:
                put_file(fpath, fh.read(), 'Auto-generate page: ' + fpath)
                ok += 1
            except Exception as e:
                print('failed:', fpath, e)
    if os.path.exists('sitemap.xml'):
        with open('sitemap.xml', 'rb') as fh:
            put_file('sitemap.xml', fh.read(), 'Auto-update sitemap.xml')
    print('API published files:', ok)


def main():
    sh('git', 'config', 'user.email', 'github-actions[bot]@users.noreply.github.com')
    sh('git', 'config', 'user.name', 'github-actions[bot]')
    targets = ['blog', 'parts', 'brands', 'sitemap.xml',
               'parts.html', 'brands.html', 'vehicles.html',
               'american-cars.html', 'european-cars.html']
    existing = [t for t in targets if os.path.exists(t)]
    if existing:
        sh('git', 'add', '-A', *existing)
        r = sh('git', 'commit', '-m', 'Auto-generate category/blog pages + sitemap')
        if 'nothing to commit' not in (r.stdout + r.stderr):
            sh('git', 'fetch', 'origin', 'main')
            sh('git', 'rebase', 'origin/main')
            p = sh('git', 'push', 'origin', 'HEAD:main')
            if p.returncode == 0:
                print('pushed via git')
                return
            print('git push failed, fallback to API:', (p.stderr or '')[-300:])
        else:
            print('nothing to commit (git)')
    publish_via_api()


if __name__ == '__main__':
    main()
