#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Publish generated files (blog/*.html + parts/ + brands/ + sitemap.xml) back to the repo.
Used by the GitHub Action. Uses git (checkout already configured with push token).
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
    sh('git', 'add', '-A', *existing)
    r = sh('git', 'commit', '-m', 'Auto-generate category/blog pages + sitemap')
    if 'nothing to commit' in (r.stdout + r.stderr):
        print('no changes to commit')
        return
    p = sh('git', 'push')
    print('push stdout:', p.stdout)
    print('push stderr:', p.stderr)


if __name__ == '__main__':
    main()
