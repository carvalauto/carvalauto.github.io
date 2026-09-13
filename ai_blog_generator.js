/**
 * AI 博客文章生成器（真实性优先）
 * 原理：把【真实产品数据】(OEM/车型/规格/图片) 喂给 DeepSeek，
 *       要求它只使用给定事实、用自然的真人语气写，禁止编造。
 *
 * 用法:
 *   node ai_blog_generator.js 3            # 生成 3 篇（随机选产品）
 *   node ai_blog_generator.js 1 92101-1R520  # 为指定 OEM 生成 1 篇
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY
  || (fs.existsSync(path.join(__dirname, 'deepseek.key')) ? fs.readFileSync(path.join(__dirname, 'deepseek.key'), 'utf8').trim() : '');
if (!DEEPSEEK_KEY) {
  console.error('缺少 DeepSeek Key。请设置环境变量 DEEPSEEK_KEY，或在脚本同目录放一个 deepseek.key 文件。');
  process.exit(1);
}
const REPO_DIR = __dirname;
const OSS_PRODUCTS = 'https://carvalauto-products.oss-cn-hangzhou.aliyuncs.com/products.json';
const SITE = 'https://carvalautopart.com';

function req(opts, body) {
  return new Promise((resolve, reject) => {
    const r = https.request(opts, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}
async function getJSON(url) {
  const r = await req({ hostname: new URL(url).hostname, path: new URL(url).pathname + new URL(url).search, method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0' } });
  return JSON.parse(r.body);
}
async function deepseek(messages, maxTokens) {
  const body = JSON.stringify({ model: 'deepseek-chat', messages, temperature: 0.85, max_tokens: maxTokens || 4000 });
  const r = await req({
    hostname: 'api.deepseek.com', path: '/chat/completions', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY, 'Content-Length': Buffer.byteLength(body) }
  }, body);
  if (r.status !== 200) throw new Error('DeepSeek ' + r.status + ': ' + r.body.slice(0, 200));
  return JSON.parse(r.body).choices[0].message.content;
}

function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}
function extractJSON(text) {
  // 去掉 ```json ... ``` 包裹
  let t = text.trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (m) t = m[1].trim();
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s >= 0 && e > s) t = t.slice(s, e + 1);
  return JSON.parse(t);
}

function fitmentText(p) {
  const ft = p.fitmentTable || [];
  if (!ft.length) return '(no fitment listed)';
  return ft.slice(0, 15).map(f => [f.make, f.model, f.year, f.engine].filter(Boolean).join(' ')).join('; ');
}
function specsText(p) {
  const sp = p.specs || [];
  if (!sp.length) return '(no specs listed)';
  return sp.map(s => s.name + ': ' + s.value).join('; ');
}

async function generateArticle(p) {
  const oem = p.oem || p.oemCode || '';
  const name = p.name || p.title || '';
  const system = 'You are a professional automotive content writer for a wholesale auto parts supplier. You write natural, human-sounding English that reads like an experienced mechanic wrote it. You NEVER invent facts. You ALWAYS output valid JSON only.';
  const user = [
    'Write a blog article in English about this specific auto part.',
    '',
    '=== REAL PRODUCT DATA (use EXACTLY these facts; do NOT invent anything) ===',
    'Part name: ' + name,
    'OEM / Part number: ' + (oem || 'unknown'),
    'Category: ' + (p.category || ''),
    'Compatible vehicles: ' + fitmentText(p),
    'Specifications: ' + specsText(p),
    '=== END DATA ===',
    '',
    'STRICT RULES:',
    '- Only use the OEM number, vehicle models and specs given above. Do NOT make up any other part numbers, models, years or specs.',
    '- Write naturally like a knowledgeable person, not like a robot. Avoid clichés and filler.',
    '- The article must be genuinely useful to someone searching for this part.',
    '- Mention the OEM number naturally 2-4 times.',
    '- Length: about 900-1300 words.',
    '- Structure with <h2>/<h3> headings and <p> paragraphs (HTML). Include an intro, when/why to replace it, compatibility, how to choose, installation tips, and a short FAQ (3 questions).',
    '- End with one natural sentence mentioning the supplier (Carval Auto Parts) and link to https://carvalautopart.com',
    '- Do NOT include a markdown title inside content (the title is separate).',
    '',
    'Return STRICT JSON only, no extra text:',
    '{',
    '  "title": "<specific, natural title including the OEM number and main vehicle, 50-65 chars>",',
    '  "excerpt": "<1-2 sentence summary, 120-160 chars>",',
    '  "content": "<the full article as HTML: h2/h3/p/ul/li>",',
    '  "tags": "<4-6 comma-separated tags>",',
    '  "meta_description": "<SEO meta description, 140-160 chars>",',
    '  "category": "<one of: Product Guides, Buying Guides, Maintenance Tips, DIY Tutorials, Industry News>"',
    '}'
  ].join('\n');

  const out = await deepseek([{ role: 'system', content: system }, { role: 'user', content: user }], 4500);
  const j = extractJSON(out);
  return {
    title: j.title,
    slug: slugify(j.title),
    content: j.content,
    excerpt: j.excerpt,
    author: 'Carval Auto Team',
    category: j.category || 'Product Guides',
    tags: j.tags,
    image: (p.images && p.images[0]) || '',
    date: new Date().toISOString().slice(0, 10),
    status: 'published',
    views: 0,
    seo: { title: j.title + ' | Carval Auto Parts', description: j.meta_description, keywords: j.tags }
  };
}

(async () => {
  const args = process.argv.slice(2);
  const count = parseInt(args[0] || '1', 10);
  const targetOem = args[1];

  const data = await getJSON(OSS_PRODUCTS + '?t=' + Date.now());
  const products = Array.isArray(data) ? data : (data.products || []);
  console.log('产品总数:', products.length);

  // 选产品：指定OEM 或 随机（优先有车型+图片的）
  let picked = [];
  if (targetOem) {
    picked = products.filter(p => (p.oem || p.oemCode || '').toUpperCase().includes(targetOem.toUpperCase())).slice(0, count);
  } else {
    const pool = products.filter(p => (p.images && p.images.length) && (p.fitmentTable && p.fitmentTable.length));
    const shuffled = pool.sort(() => Math.random() - 0.5);
    picked = shuffled.slice(0, count);
  }
  if (!picked.length) { console.log('没找到合适的产品'); return; }
  console.log('选中产品:', picked.map(p => p.oem || p.name).join(' | '));

  // 读现有 blogs.json
  const blogsPath = path.join(REPO_DIR, 'data', 'blogs.json');
  const blogData = JSON.parse(fs.readFileSync(blogsPath, 'utf8'));
  blogData.blogs = blogData.blogs || [];
  const existingSlugs = new Set(blogData.blogs.map(b => b.slug));
  let nextId = Math.max(0, ...blogData.blogs.map(b => b.id || 0)) + 1;

  for (const p of picked) {
    console.log('\n生成中:', p.oem || p.name, '...');
    try {
      const art = await generateArticle(p);
      if (existingSlugs.has(art.slug)) { console.log('  已存在，跳过:', art.slug); continue; }
      art.id = nextId++;
      blogData.blogs.push(art);
      console.log('  ✅', art.title);
      console.log('     slug:', art.slug, '| tags:', art.tags);
    } catch (e) {
      console.log('  ❌ 失败:', e.message);
    }
  }

  fs.writeFileSync(blogsPath, JSON.stringify(blogData, null, 2), 'utf8');
  console.log('\n已写入', blogsPath, '（共', blogData.blogs.length, '篇）');
})();
