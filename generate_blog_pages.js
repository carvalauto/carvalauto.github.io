const fs = require('fs');
const path = require('path');

const REPO = __dirname;
const SITE = 'https://carvalautopart.com';

const data = JSON.parse(fs.readFileSync(path.join(REPO, 'data', 'blogs.json'), 'utf8'));
const blogs = (data.blogs || []).filter(b => b.status === 'published');
console.log('已发布文章:', blogs.length);

const single = fs.readFileSync(path.join(REPO, 'blog-template.html'), 'utf8');

// 提取 <style>...</style>
const styleStart = single.indexOf('<style>');
const styleEnd = single.indexOf('</style>') + '</style>'.length;
const styleBlock = single.slice(styleStart, styleEnd);

// 提取 body 里的 header + footer（去掉 main 和 script）
const bodyStart = single.indexOf('<body>');
const headerStart = single.indexOf('<header class="topbar">');
const headerEnd = single.indexOf('</header>') + '</header>'.length;
const headerBlock = single.slice(headerStart, headerEnd);
const footerStart = single.indexOf('<footer>');
const footerEnd = single.indexOf('</footer>') + '</footer>'.length;
const footerBlock = single.slice(footerStart, footerEnd);

// 把 header/footer 里的相对链接改成绝对路径
function toAbsolute(html) {
  return html
    .replace(/href="index\.html"/g, 'href="/index.html"')
    .replace(/href="products\.html"/g, 'href="/products.html"')
    .replace(/href="blog\.html"/g, 'href="/blog.html"')
    .replace(/href="faq\.html"/g, 'href="/faq.html"');
}
const headerAbs = toAbsolute(headerBlock);
const footerAbs = toAbsolute(footerBlock);

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}
// 给 h2/h3 加 id 并生成 TOC
function addHeadingIds(html) {
  let idx = 0;
  const toc = [];
  const out = html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (m, lvl, attrs, text) => {
    const id = 'heading-' + idx;
    const plain = text.replace(/<[^>]+>/g, '').trim();
    toc.push({ id, text: plain, level: lvl });
    idx++;
    return `<h${lvl}${attrs} id="${id}">${text}</h${lvl}>`;
  });
  return { html: out, toc };
}

// 相关文章（同分类优先，取3篇）
function relatedFor(article) {
  const same = blogs.filter(b => b.slug !== article.slug && b.category === article.category);
  const others = blogs.filter(b => b.slug !== article.slug && b.category !== article.category);
  return [...same, ...others].slice(0, 3);
}

const outDir = path.join(REPO, 'blog');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

let count = 0;
for (const a of blogs) {
  const url = `${SITE}/blog/${a.slug}.html`;
  const title = (a.seo && a.seo.title) || `${a.title} | Carval Auto Parts`;
  const desc = (a.seo && a.seo.description) || a.excerpt || '';
  const keywords = (a.seo && a.seo.keywords) || a.tags || '';
  const image = a.image || `${SITE}/carval-auto-logo.png`;
  const dateStr = formatDate(a.date);
  const firstLetter = (a.author || 'C').charAt(0).toUpperCase();

  const { html: contentWithIds, toc } = addHeadingIds(a.content || '');

  const tocHtml = toc.map(t => `<li class="toc-${t.level === '2' ? 'h2' : 'h3'}"><a href="#${t.id}">${esc(t.text)}</a></li>`).join('\n                        ');

  const rel = relatedFor(a);
  const relatedHtml = rel.map(r => `
                        <a href="/blog/${r.slug}.html" class="related-card">
                            <img src="${esc(r.image)}" alt="${esc(r.title)}" loading="lazy">
                            <span class="related-category">${esc(r.category)}</span>
                            <h4 class="related-card-title">${esc(r.title)}</h4>
                        </a>`).join('');

  const tagsHtml = String(a.tags || '').split(',').map(t => t.trim()).filter(Boolean).map(tag =>
    `<a href="/blog.html" class="article-tag"><i class="fas fa-tag"></i> ${esc(tag)}</a>`).join('\n                    ');

  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": a.title,
    "description": desc,
    "image": image,
    "datePublished": a.date,
    "dateModified": a.date,
    "author": { "@type": "Organization", "name": a.author || "Carval Auto Parts" },
    "publisher": { "@type": "Organization", "name": "Carval Auto Parts", "logo": { "@type": "ImageObject", "url": `${SITE}/carval-auto-logo.png` } },
    "mainEntityOfPage": { "@type": "WebPage", "@id": url }
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(desc)}">
    <meta name="keywords" content="${esc(keywords)}">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${url}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${url}">
    <meta property="og:title" content="${esc(a.title)}">
    <meta property="og:description" content="${esc(desc)}">
    <meta property="og:image" content="${esc(image)}">
    <meta property="og:site_name" content="Carval Auto Parts">
    <meta property="article:published_time" content="${esc(a.date)}">
    <meta property="article:author" content="${esc(a.author)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(a.title)}">
    <meta name="twitter:description" content="${esc(desc)}">
    <meta name="twitter:image" content="${esc(image)}">
    <link rel="icon" type="image/png" href="${SITE}/carval-auto-logo.png">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" media="print" onload="this.media='all'">
    <script type="application/ld+json">${JSON.stringify(schema)}</script>
${styleBlock}
</head>
<body>
    ${headerAbs}

    <nav class="breadcrumb">
        <div class="breadcrumb-inner">
            <a href="/index.html"><i class="fas fa-home"></i> Home</a>
            <span>/</span>
            <a href="/blog.html">Blog</a>
            <span>/</span>
            <span>${esc(a.title)}</span>
        </div>
    </nav>

    <main class="article-container">
        <article>
            <header class="article-header">
                <span class="article-category">${esc(a.category)}</span>
                <h1 class="article-title">${esc(a.title)}</h1>
                <div class="article-meta">
                    <div class="article-author">
                        <div class="article-author-avatar">${firstLetter}</div>
                        <div class="article-author-info">
                            <span class="article-author-name">${esc(a.author)}</span>
                            <span class="article-author-label">Author</span>
                        </div>
                    </div>
                    <div class="article-date"><i class="far fa-calendar"></i> ${esc(dateStr)}</div>
                </div>
            </header>

            <img src="${esc(image)}" alt="${esc(a.title)}" class="article-featured-image" loading="lazy">

            <div class="article-content">
                ${contentWithIds}
            </div>

            <div class="article-tags">
                <span style="font-weight: 600; margin-right: 8px;">Tags:</span>
                ${tagsHtml}
            </div>

            <div class="article-share">
                <span class="article-share-label">Share:</span>
                <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}" target="_blank" class="share-btn facebook"><i class="fab fa-facebook-f"></i></a>
                <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(a.title)}" target="_blank" class="share-btn twitter"><i class="fab fa-twitter"></i></a>
                <a href="https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(url)}&title=${encodeURIComponent(a.title)}" target="_blank" class="share-btn linkedin"><i class="fab fa-linkedin-in"></i></a>
                <a href="https://wa.me/?text=${encodeURIComponent(a.title + ' ' + url)}" target="_blank" class="share-btn whatsapp"><i class="fab fa-whatsapp"></i></a>
            </div>

            <div class="author-box">
                <div class="author-box-avatar">${firstLetter}</div>
                <div class="author-box-content">
                    <h4 class="author-box-name">${esc(a.author)}</h4>
                    <p class="author-box-bio">Carval Auto Parts team of automotive experts, providing quality parts and professional advice since 2008.</p>
                </div>
            </div>

            <section class="related-section">
                <h2 class="related-title"><i class="fas fa-newspaper"></i> Related Articles</h2>
                <div class="related-grid">${relatedHtml}
                </div>
            </section>
        </article>

        <aside class="sidebar">
            <div class="sidebar-section">
                <h3 class="sidebar-title"><i class="fas fa-list"></i> Table of Contents</h3>
                <ul class="table-of-contents">
                    ${tocHtml}
                </ul>
            </div>
            <div class="sidebar-section" style="margin-top:20px;padding:16px;background:#fff;border:1px solid #e0e0e0;border-radius:8px;">
                <h3 class="sidebar-title"><i class="fas fa-box"></i> Need Parts?</h3>
                <p style="font-size:0.9rem;color:#555;margin-bottom:10px;">Wholesale OEM auto parts for Japanese, Korean, German &amp; Chinese vehicles.</p>
                <a href="/products.html" style="display:inline-block;background:#D62B2B;color:#fff;padding:10px 18px;border-radius:4px;font-weight:600;">Browse Products</a>
            </div>
        </aside>
    </main>

    ${footerAbs}
</body>
</html>`;

  fs.writeFileSync(path.join(outDir, `${a.slug}.html`), html, 'utf8');
  count++;
}
console.log('生成静态页:', count, '个 →', outDir);
