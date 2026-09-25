#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Build step (run by GitHub Action every 6h and on push):
  1) Generate static blog pages  blog/<slug>.html  from data/blogs.json + blog-template.html
  2) Generate sitemap.xml  (products + blog + static pages)
Every sitemap URL is guaranteed to resolve.
"""
import os
import re
import json
import html as htmlmod
from datetime import datetime

BASE = 'https://carvalautopart.com'
PRODUCTS_DIR = 'products'
BLOG_DIR = 'blog'
TEMPLATE = 'blog-template.html'
BLOGS_JSON = os.path.join('data', 'blogs.json')

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def esc(s):
    return htmlmod.escape(str(s or ''), quote=True)


def format_date(d):
    if not d:
        return ''
    try:
        dt = datetime.strptime(str(d)[:10], '%Y-%m-%d')
        return dt.strftime('%B %-d, %Y')
    except Exception:
        try:
            dt = datetime.strptime(str(d)[:10], '%Y-%m-%d')
            return dt.strftime('%B %d, %Y')
        except Exception:
            return str(d)


def add_heading_ids(content):
    toc = []
    counter = [0]

    def repl(m):
        lvl = m.group(1)
        attrs = m.group(2)
        text = m.group(3)
        hid = 'heading-' + str(counter[0])
        plain = re.sub(r'<[^>]+>', '', text).strip()
        toc.append({'id': hid, 'text': plain, 'level': lvl})
        counter[0] += 1
        return '<h' + lvl + attrs + ' id="' + hid + '">' + text + '</h' + lvl + '>'

    out = re.sub(r'<h([23])([^>]*)>([\s\S]*?)</h\1>', repl, content, flags=re.I)
    return out, toc


def to_absolute(h):
    return (h.replace('href="index.html"', 'href="/index.html"')
             .replace('href="products.html"', 'href="/products.html"')
             .replace('href="blog.html"', 'href="/blog.html"')
             .replace('href="faq.html"', 'href="/faq.html"'))


# ---------------------------------------------------------------------------
# 1) generate blog static pages
# ---------------------------------------------------------------------------
def generate_blog_pages():
    if not os.path.exists(BLOGS_JSON) or not os.path.exists(TEMPLATE):
        print('skip blog generation (missing blogs.json or template)')
        return
    with open(BLOGS_JSON, encoding='utf-8') as f:
        data = json.load(f)
    blogs = [b for b in (data.get('blogs') or []) if b.get('status') == 'published']
    if not blogs:
        print('no published blogs')
        return

    tpl = open(TEMPLATE, encoding='utf-8').read()
    style = tpl[tpl.index('<style>'):tpl.index('</style>') + len('</style>')]
    header = to_absolute(tpl[tpl.index('<header class="topbar">'):tpl.index('</header>') + len('</header>')])
    footer = to_absolute(tpl[tpl.index('<footer>'):tpl.index('</footer>') + len('</footer>')])

    os.makedirs(BLOG_DIR, exist_ok=True)

    def related_for(a):
        same = [b for b in blogs if b['slug'] != a['slug'] and b.get('category') == a.get('category')]
        others = [b for b in blogs if b['slug'] != a['slug'] and b.get('category') != a.get('category')]
        return (same + others)[:3]

    count = 0
    for a in blogs:
        slug = a['slug']
        url = BASE + '/blog/' + slug + '.html'
        seo = a.get('seo') or {}
        title = seo.get('title') or (a.get('title', '') + ' | Carval Auto Parts')
        desc = seo.get('description') or a.get('excerpt') or ''
        keywords = seo.get('keywords') or a.get('tags') or ''
        image = a.get('image') or (BASE + '/carval-auto-logo.png')
        date_str = format_date(a.get('date'))
        first_letter = (a.get('author') or 'C')[:1].upper()

        content, toc = add_heading_ids(a.get('content') or '')
        toc_html = '\n                        '.join(
            '<li class="toc-%s"><a href="#%s">%s</a></li>' % ('h2' if t['level'] == '2' else 'h3', t['id'], esc(t['text']))
            for t in toc
        )
        rel = related_for(a)
        related_html = ''.join(
            '\n                        <a href="/blog/%s.html" class="related-card">'
            '<img src="%s" alt="%s" loading="lazy">'
            '<span class="related-category">%s</span>'
            '<h4 class="related-card-title">%s</h4></a>' % (
                r['slug'], esc(r.get('image')), esc(r.get('title')), esc(r.get('category')), esc(r.get('title')))
            for r in rel
        )
        tags_html = '\n                    '.join(
            '<a href="/blog.html" class="article-tag"><i class="fas fa-tag"></i> %s</a>' % esc(t.strip())
            for t in str(a.get('tags') or '').split(',') if t.strip()
        )

        schema = {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": a.get('title', ''),
            "description": desc,
            "image": image,
            "datePublished": a.get('date', ''),
            "dateModified": a.get('date', ''),
            "author": {"@type": "Organization", "name": a.get('author') or 'Carval Auto Parts'},
            "publisher": {"@type": "Organization", "name": "Carval Auto Parts",
                          "logo": {"@type": "ImageObject", "url": BASE + "/carval-auto-logo.png"}},
            "mainEntityOfPage": {"@type": "WebPage", "@id": url}
        }

        page = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%(title)s</title>
    <meta name="description" content="%(desc)s">
    <meta name="keywords" content="%(keywords)s">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="%(url)s">
    <meta property="og:type" content="article">
    <meta property="og:url" content="%(url)s">
    <meta property="og:title" content="%(rawtitle)s">
    <meta property="og:description" content="%(desc)s">
    <meta property="og:image" content="%(image)s">
    <meta property="og:site_name" content="Carval Auto Parts">
    <meta property="article:published_time" content="%(date)s">
    <meta property="article:author" content="%(author)s">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="%(rawtitle)s">
    <meta name="twitter:description" content="%(desc)s">
    <meta name="twitter:image" content="%(image)s">
    <link rel="icon" type="image/png" href="https://carvalautopart.com/carval-auto-logo.png">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" media="print" onload="this.media='all'">
    <script type="application/ld+json">%(schema)s</script>
%(style)s
</head>
<body>
    %(header)s

    <nav class="breadcrumb">
        <div class="breadcrumb-inner">
            <a href="/index.html"><i class="fas fa-home"></i> Home</a>
            <span>/</span>
            <a href="/blog.html">Blog</a>
            <span>/</span>
            <span>%(rawtitle)s</span>
        </div>
    </nav>

    <main class="article-container">
        <article>
            <header class="article-header">
                <span class="article-category">%(category)s</span>
                <h1 class="article-title">%(rawtitle)s</h1>
                <div class="article-meta">
                    <div class="article-author">
                        <div class="article-author-avatar">%(fl)s</div>
                        <div class="article-author-info">
                            <span class="article-author-name">%(author)s</span>
                            <span class="article-author-label">Author</span>
                        </div>
                    </div>
                    <div class="article-date"><i class="far fa-calendar"></i> %(datestr)s</div>
                </div>
            </header>

            <img src="%(image)s" alt="%(rawtitle)s" class="article-featured-image" loading="lazy">

            <div class="article-content">
                %(content)s
            </div>

            <div class="article-tags">
                <span style="font-weight: 600; margin-right: 8px;">Tags:</span>
                %(tags)s
            </div>

            <div class="article-share">
                <span class="article-share-label">Share:</span>
                <a href="https://www.facebook.com/sharer/sharer.php?u=%(urlenc)s" target="_blank" class="share-btn facebook"><i class="fab fa-facebook-f"></i></a>
                <a href="https://twitter.com/intent/tweet?url=%(urlenc)s&text=%(titleenc)s" target="_blank" class="share-btn twitter"><i class="fab fa-twitter"></i></a>
                <a href="https://www.linkedin.com/shareArticle?mini=true&url=%(urlenc)s&title=%(titleenc)s" target="_blank" class="share-btn linkedin"><i class="fab fa-linkedin-in"></i></a>
                <a href="https://wa.me/?text=%(waenc)s" target="_blank" class="share-btn whatsapp"><i class="fab fa-whatsapp"></i></a>
            </div>

            <div class="author-box">
                <div class="author-box-avatar">%(fl)s</div>
                <div class="author-box-content">
                    <h4 class="author-box-name">%(author)s</h4>
                    <p class="author-box-bio">Carval Auto Parts team of automotive experts, providing quality parts and professional advice since 2008.</p>
                </div>
            </div>

            <section class="related-section">
                <h2 class="related-title"><i class="fas fa-newspaper"></i> Related Articles</h2>
                <div class="related-grid">%(related)s
                </div>
            </section>
        </article>

        <aside class="sidebar">
            <div class="sidebar-section">
                <h3 class="sidebar-title"><i class="fas fa-list"></i> Table of Contents</h3>
                <ul class="table-of-contents">
                    %(toc)s
                </ul>
            </div>
            <div class="sidebar-section" style="margin-top:20px;padding:16px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;">
                <h3 class="sidebar-title"><i class="fas fa-box"></i> Need Parts?</h3>
                <p style="font-size:0.9rem;color:#555;margin-bottom:10px;">Wholesale OEM auto parts for Japanese, Korean, German &amp; Chinese vehicles.</p>
                <a href="/products.html" style="display:inline-block;background:#D62B2B;color:#fff;padding:10px 18px;border-radius:4px;font-weight:600;">Browse Products</a>
            </div>
        </aside>
    </main>

    %(footer)s
</body>
</html>''' % {
            'title': esc(title),
            'rawtitle': esc(a.get('title')),
            'desc': esc(desc),
            'keywords': esc(keywords),
            'url': url,
            'image': esc(image),
            'date': esc(a.get('date')),
            'author': esc(a.get('author')),
            'category': esc(a.get('category')),
            'fl': first_letter,
            'datestr': esc(date_str),
            'content': content,
            'tags': tags_html,
            'toc': toc_html,
            'related': related_html,
            'schema': json.dumps(schema, ensure_ascii=False),
            'urlenc': url.replace('&', '%26'),
            'titleenc': esc(a.get('title')).replace(' ', '%20'),
            'waenc': (esc(a.get('title')) + ' ' + url).replace(' ', '%20'),
            'style': style,
            'header': header,
            'footer': footer,
        }

        with open(os.path.join(BLOG_DIR, slug + '.html'), 'w', encoding='utf-8') as f:
            f.write(page)
        count += 1
    print('Blog static pages generated:', count)


# ---------------------------------------------------------------------------
# 2) generate sitemap
# ---------------------------------------------------------------------------
def collect_html_files(root):
    files = []
    if not os.path.isdir(root):
        return files
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith('.')]
        for fn in sorted(filenames):
            if fn.endswith('.html'):
                rel = os.path.join(dirpath, fn).replace('\\', '/')
                files.append(rel)
    return files


def generate_sitemap():
    today = datetime.now().strftime('%Y-%m-%d')
    static_urls = [
        ('https://carvalautopart.com/', 'daily', '1.0'),
        ('https://carvalautopart.com/products.html', 'daily', '0.9'),
        ('https://carvalautopart.com/index.html', 'weekly', '0.8'),
        ('https://carvalautopart.com/blog.html', 'weekly', '0.8'),
        ('https://carvalautopart.com/faq.html', 'weekly', '0.7'),
        ('https://carvalautopart.com/japanese-cars.html', 'weekly', '0.7'),
        ('https://carvalautopart.com/korean-cars.html', 'weekly', '0.7'),
        ('https://carvalautopart.com/german-cars.html', 'weekly', '0.7'),
        ('https://carvalautopart.com/chinese-cars.html', 'weekly', '0.7'),
        ('https://carvalautopart.com/engine-oil.html', 'weekly', '0.7'),
    ]
    product_files = collect_html_files(PRODUCTS_DIR)
    blog_files = collect_html_files(BLOG_DIR)
    print('Product HTML files:', len(product_files))
    print('Blog HTML files:', len(blog_files))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, freq, prio in static_urls:
        lines += ['  <url>', '    <loc>' + loc + '</loc>', '    <lastmod>' + today + '</lastmod>',
                  '    <changefreq>' + freq + '</changefreq>', '    <priority>' + prio + '</priority>', '  </url>']
    for f in product_files:
        lines += ['  <url>', '    <loc>' + BASE + '/' + f + '</loc>', '    <lastmod>' + today + '</lastmod>',
                  '    <changefreq>weekly</changefreq>', '    <priority>0.8</priority>', '  </url>']
    for f in blog_files:
        lines += ['  <url>', '    <loc>' + BASE + '/' + f + '</loc>', '    <lastmod>' + today + '</lastmod>',
                  '    <changefreq>monthly</changefreq>', '    <priority>0.6</priority>', '  </url>']
    lines.append('</urlset>')

    with open('sitemap.xml', 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    print('Sitemap generated! ' + str(len(product_files)) + ' products + ' + str(len(blog_files)) + ' blog + ' + str(len(static_urls)) + ' static')


if __name__ == '__main__':
    generate_blog_pages()
    generate_sitemap()
