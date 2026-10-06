#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Publish generated files (blog/ + parts/ + brands/ + sitemap.xml) back to the repo.
Used by the GitHub Action. Single git commit + push to main (works from detached HEAD).
"""
import os
import subprocess


def sh(*args):
    print('$', ' '.join(args))
    return subprocess.run(args, capture_output=True, text=True)


def main():
    sh('git', 'config', 'user.email', 'github-actions[bot]@users.noreply.github.com')
    sh('git', 'config', 'user.name', 'github-actions[bot]')
    targets = ['blog', 'parts', 'brands', 'sitemap.xml',
               'parts.html', 'brands.html', 'vehicles.html',
               'american-cars.html', 'european-cars.html']
    existing = [t for t in targets if os.path.exists(t)]
    if not existing:
        print('nothing to add')
        return
    sh('git', 'add', '-A', *existing)
    r = sh('git', 'commit', '-m', 'Auto-generate category/blog pages + sitemap')
    if 'nothing to commit' in (r.stdout + r.stderr):
        print('no changes to commit')
        return
    # 同步远程最新，避免 non-fast-forward
    sh('git', 'fetch', 'origin', 'main')
    sh('git', 'rebase', 'origin/main')
    p = sh('git', 'push', 'origin', 'HEAD:main')
    print('push stdout:', p.stdout)
    print('push stderr:', p.stderr)
    if p.returncode != 0:
        print('::error::git push failed with code', p.returncode)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
