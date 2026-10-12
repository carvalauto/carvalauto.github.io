#!/usr/bin/env node
/*
 * gen_seo_full.js — 三平台 SEO 全维度×多时间段数据生成器
 * 运行环境：
 *   本地：可设 PROXY_HOST/PORT（如 127.0.0.1:10808），密钥从环境或本地文件读
 *   GitHub Actions：无需代理，密钥从环境变量(secrets)读
 * 输出：seo_stats_full.json（写入本地 + 上传 OSS）
 *
 * 环境变量：
 *   GSC_SA_JSON     Google 服务账号 JSON 字符串（推荐）或 GSC_KEY_FILE 路径
 *   GSC_KEY_FILE    服务账号 JSON 文件路径（本地调试用）
 *   BING_KEY        Bing Webmaster API key
 *   YANDEX_TOKEN    Yandex OAuth token
 *   YANDEX_UID      Yandex user id
 *   OSS_AK / OSS_SK 阿里云 OSS 访问密钥（用于上传，可选；不设则只写本地）
 *   PROXY_HOST/PROXY_PORT  可选，走代理
 */
const fs = require('fs');
const net = require('net');
const tls = require('tls');
const https = require('https');
const crypto = require('crypto');

const SITE = 'https://carvalautopart.com/';
const RANGES = [3, 7, 15, 30, 60, 90, 180];
const PROXY = process.env.PROXY_HOST ? { host: process.env.PROXY_HOST, port: Number(process.env.PROXY_PORT || 10808) } : null;

// ---------- 密钥 ----------
function gscKey() {
  if (process.env.GSC_SA_JSON) return JSON.parse(process.env.GSC_SA_JSON);
  const f = process.env.GSC_KEY_FILE || 'C:\\Users\\Administrator\\AppData\\Local\\Temp\\opencode\\parabolic-clock-444703-s4-d9118d3a485e.json';
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
const BING_KEY = process.env.BING_KEY || 'f254e717eb444080815702fd2ea34920';
const YTOKEN = process.env.YANDEX_TOKEN || 'y0__wgBEN6Vq9oIGLfKSiCD2MWVGezLrV3xbhaV3nCmXxlqeJAIWmGn';
const YUID = process.env.YANDEX_UID || '2336934622';
const YHID = 'https:carvalautopart.com:443';

// ---------- HTTP（可走代理）----------
function dc(b) { const p = []; let i = 0; while (i < b.length) { const n = b.indexOf('\r\n', i); if (n < 0) break; const s = parseInt(b.slice(i, n).toString(), 16); if (isNaN(s) || s === 0) break; p.push(b.slice(n + 2, n + 2 + s)); i = n + 2 + s + 2; } return Buffer.concat(p); }
function direct(host, method, path, headers, body) {
  return new Promise((res, rej) => {
    const data = body || null;
    const req = https.request({ hostname: host, path, method, headers: Object.assign({ 'Accept-Encoding': 'identity' }, headers, data ? { 'Content-Length': Buffer.byteLength(data) } : {}), timeout: 30000 }, r => { const bs = []; r.on('data', c => bs.push(c)); r.on('end', () => { const b = Buffer.concat(bs); res({ status: r.statusCode, body: b.toString('utf8') }); }); });
    req.on('error', rej); req.on('timeout', () => { req.destroy(new Error('timeout')); });
    if (data) req.write(data); req.end();
  });
}
function viaProxy(host, method, path, headers, body) {
  return new Promise((res, rej) => {
    const sk = net.connect(PROXY.port, PROXY.host, () => sk.write('CONNECT ' + host + ':443 HTTP/1.1\r\nHost: ' + host + ':443\r\n\r\n'));
    let hs = Buffer.alloc(0), done = false;
    const od = c => { if (done) return; hs = Buffer.concat([hs, c]); const x = hs.indexOf('\r\n\r\n'); if (x < 0) return; if (!/ 200 /.test(hs.slice(0, x).toString())) { rej(new Error('proxy fail')); return; } done = true; sk.removeListener('data', od); const t = tls.connect({ socket: sk, servername: host }, () => { const H = Object.assign({ 'Accept-Encoding': 'identity' }, headers); if (body && !H['Content-Length']) H['Content-Length'] = Buffer.byteLength(body); let r = method + ' ' + path + ' HTTP/1.1\r\nHost: ' + host + '\r\n'; for (const k in H) r += k + ': ' + H[k] + '\r\n'; r += 'Connection: close\r\n\r\n'; if (body) t.write(r + body); else t.write(r); }); const bs = []; t.on('data', z => bs.push(z)); t.on('end', () => { const raw = Buffer.concat(bs); const s = raw.indexOf('\r\n\r\n'); const ht = raw.slice(0, s).toString(); let b = raw.slice(s + 4); if (/chunked/i.test(ht)) b = dc(b); res({ status: parseInt(ht.split(' ')[1]), body: b.toString('utf8') }); }); t.on('error', rej); }; sk.on('data', od); sk.on('error', rej);
  });
}
const req = (host, method, path, headers, body) => (PROXY ? viaProxy : direct)(host, method, path, headers || {}, body);

// ---------- Google ----------
function b64url(x) { return Buffer.from(x).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
let GT = null;
async function googleToken() {
  if (GT && GT.exp > Date.now() / 1000 + 60) return GT.tok;
  const key = gscKey();
  const now = Math.floor(Date.now() / 1000);
  const un = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64url(JSON.stringify({ iss: key.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sg = crypto.createSign('RSA-SHA256'); sg.update(un); const jwt = un + '.' + b64url(sg.sign(key.private_key));
  const body = 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + encodeURIComponent(jwt);
  const r = await req('oauth2.googleapis.com', 'POST', '/token', { 'Content-Type': 'application/x-www-form-urlencoded' }, body);
  const j = JSON.parse(r.body);
  GT = { tok: j.access_token, exp: now + 3000 };
  return GT.tok;
}
function fmt(d) { return d.toISOString().slice(0, 10); }
async function gscQuery(at, startDate, endDate, dimensions, rowLimit) {
  const body = JSON.stringify({ startDate, endDate, dimensions, rowLimit: rowLimit || 100 });
  const r = await req('www.googleapis.com', 'POST', '/webmasters/v3/sites/' + encodeURIComponent(SITE) + '/searchAnalytics/query', { 'Authorization': 'Bearer ' + at, 'Content-Type': 'application/json' }, body);
  try { return JSON.parse(r.body).rows || []; } catch (e) { return []; }
}
async function googleRange(days) {
  const at = await googleToken();
  const end = new Date(Date.now() - 2 * 86400000); // GSC 延迟，回退2天
  const start = new Date(end.getTime() - days * 86400000);
  const s = fmt(start), e = fmt(end);
  const out = { range: { start: s, end: e } };
  const dateRows = await gscQuery(at, s, e, ['date'], 500);
  out.byDate = dateRows.map(x => ({ date: x.keys[0], clicks: x.clicks, impressions: x.impressions, ctr: +(x.ctr * 100).toFixed(2), position: +x.position.toFixed(1) }));
  let c = 0, i = 0, ctr = 0, pos = 0;
  dateRows.forEach(x => { c += x.clicks; i += x.impressions; ctr += x.ctr * x.impressions; pos += x.position * x.impressions; });
  out.totals = { clicks: c, impressions: i, ctr: i ? +(ctr / i * 100).toFixed(2) : 0, position: i ? +(pos / i).toFixed(1) : 0, days: dateRows.length };
  const rows = { byQuery: await gscQuery(at, s, e, ['query'], 200), byPage: await gscQuery(at, s, e, ['page'], 200), byCountry: await gscQuery(at, s, e, ['country'], 50), byDevice: await gscQuery(at, s, e, ['device'], 5) };
  out.byQuery = rows.byQuery.map(x => ({ q: x.keys[0], clicks: x.clicks, impressions: x.impressions, ctr: +(x.ctr * 100).toFixed(2), position: +x.position.toFixed(1) }));
  out.byPage = rows.byPage.map(x => ({ page: x.keys[0].replace('https://carvalautopart.com', ''), clicks: x.clicks, impressions: x.impressions, ctr: +(x.ctr * 100).toFixed(2), position: +x.position.toFixed(1) }));
  out.byCountry = rows.byCountry.map(x => ({ country: x.keys[0], clicks: x.clicks, impressions: x.impressions }));
  out.byDevice = rows.byDevice.map(x => ({ device: x.keys[0], clicks: x.clicks, impressions: x.impressions }));
  return out;
}

// ---------- Bing ----------
function parseBingDate(s) { const m = /\/Date\((\d+)/.exec(String(s)); return m ? new Date(Number(m[1])).toISOString().slice(0, 10) : null; }
async function bing(method, extra) {
  const path = '/webmaster/api.svc/json/' + method + '?apikey=' + BING_KEY + '&siteUrl=' + encodeURIComponent(SITE) + (extra || '');
  const r = await req('ssl.bing.com', 'GET', path, { 'User-Agent': 'x' });
  try { return JSON.parse(r.body).d || []; } catch (e) { return []; }
}
async function bingAll() {
  const out = { totals: {}, byDate: [], byQuery: [], byPage: [] };
  try {
    const t = await bing('GetRankAndTrafficStats');
    const d = t.map(x => ({ date: parseBingDate(x.Date), clicks: x.Clicks || 0, impressions: x.Impressions || 0, position: x.AvgImpressionPosition ? +x.AvgImpressionPosition.toFixed(1) : null })).filter(x => x.date);
    out.byDate = d;
    d.forEach(x => { out.totals.clicks = (out.totals.clicks || 0) + x.clicks; out.totals.impressions = (out.totals.impressions || 0) + x.impressions; });
    const q = await bing('GetQueryStats');
    out.byQuery = q.map(x => ({ q: x.Query, clicks: x.Clicks || 0, impressions: x.Impressions || 0 })).sort((a, b) => b.impressions - a.impressions).slice(0, 200);
    const p = await bing('GetPageStats');
    out.byPage = p.map(x => ({ page: String(x.Url || '').replace('https://carvalautopart.com', ''), clicks: x.Clicks || 0, impressions: x.Impressions || 0 })).sort((a, b) => b.impressions - a.impressions).slice(0, 200);
  } catch (e) { out.error = e.message; }
  return out;
}
function filterByRange(bingData, days) {
  const since = fmt(new Date(Date.now() - days * 86400000));
  const byDate = (bingData.byDate || []).filter(x => x.date >= since);
  const totals = { clicks: 0, impressions: 0 };
  byDate.forEach(x => { totals.clicks += x.clicks; totals.impressions += x.impressions; });
  return { totals, byDate, byQuery: bingData.byQuery || [], byPage: bingData.byPage || [] };
}

// ---------- Yandex ----------
async function yandexRange(days) {
  const yh = { 'Authorization': 'OAuth ' + YTOKEN, 'Accept': 'application/json', 'User-Agent': 'x' };
  const end = new Date(Date.now() - 86400000), start = new Date(end.getTime() - days * 86400000);
  const s = fmt(start), e = fmt(end);
  const out = {};
  try {
    const sm = await req('api.webmaster.yandex.net', 'GET', '/v4/user/' + YUID + '/hosts/' + YHID + '/summary/', yh);
    console.log('    [yandex summary] status=' + sm.status + ' body=' + String(sm.body).slice(0, 200));
    const sj = JSON.parse(sm.body);
    out.summary = { searchablePages: sj.searchable_pages_count, excludedPages: sj.excluded_pages_count, sqi: sj.sqi, problems: sj.site_problems };
    const q = await req('api.webmaster.yandex.net', 'GET', '/v4/user/' + YUID + '/hosts/' + YHID + '/search-queries/popular/?order_by=TOTAL_SHOWS&query_indicator=TOTAL_SHOWS&query_indicator=TOTAL_CLICKS&query_indicator=AVG_SHOW_POSITION&date_from=' + s + '&date_to=' + e + '&limit=200', yh);
    out.byQuery = ((JSON.parse(q.body).queries) || []).map(x => ({ q: x.query_text, clicks: (x.indicators || {}).TOTAL_CLICKS || 0, impressions: (x.indicators || {}).TOTAL_SHOWS || 0, position: (x.indicators || {}).AVG_SHOW_POSITION || null }));
  } catch (err) { out.error = err.message; }
  return out;
}

// ---------- OSS 上传 ----------
function ossPut(key, body) {
  const AK = process.env.OSS_AK, SK = process.env.OSS_SK;
  if (!AK || !SK) { console.log('  跳过 OSS 上传（未设 OSS_AK/OSS_SK）'); return Promise.resolve(); }
  const bucket = 'carvalauto-products';
  const date = new Date().toUTCString();
  const sts = ['PUT', '', 'application/json', date, 'x-oss-date:' + date, '/' + bucket + key].join('\n');
  const sig = crypto.createHmac('sha1', SK).update(sts).digest('base64');
  const data = Buffer.from(body, 'utf8');
  return new Promise((res, rej) => {
    const r = https.request({ hostname: bucket + '.oss-cn-hangzhou.aliyuncs.com', path: key, method: 'PUT', headers: { 'Content-Type': 'application/json', 'Authorization': 'OSS ' + AK + ':' + sig, 'x-oss-date': date, 'Content-Length': data.length } }, rr => { let d = ''; rr.on('data', c => d += c); rr.on('end', () => { console.log('  OSS 上传', key, rr.statusCode); res(rr.statusCode); }); });
    r.on('error', e => { console.log('  OSS 上传失败', e.message); res(null); }); r.write(data); r.end();
  });
}

(async () => {
  console.log('=== 生成三平台 SEO 全量数据 ===');
  const stats = { updated: new Date().toISOString(), site: SITE, ranges: {} };
  let bingData = null;
  try { bingData = await bingAll(); console.log('Bing 拉取完成, 天数:', (bingData.byDate || []).length); } catch (e) { console.log('Bing 失败', e.message); }
  for (const days of RANGES) {
    console.log('--- 范围 ' + days + ' 天 ---');
    const entry = {};
    try { entry.google = await googleRange(days); console.log('  Google ok: 曝光', entry.google.totals.impressions); } catch (e) { entry.google = { error: e.message }; console.log('  Google 失败', e.message); }
    try { entry.bing = bingData ? filterByRange(bingData, days) : { error: 'no data' }; } catch (e) { entry.bing = { error: e.message }; }
    try { entry.yandex = await yandexRange(days); } catch (e) { entry.yandex = { error: e.message }; }
    stats.ranges[String(days)] = entry;
    await new Promise(r => setTimeout(r, 400));
  }
  const json = JSON.stringify(stats, null, 1);
  fs.writeFileSync('seo_stats_full.json', json, 'utf8');
  console.log('已写 seo_stats_full.json, 大小', json.length, 'bytes');
  await ossPut('/seo_stats_full.json', json);
  console.log('完成');
})().catch(e => { console.error('FATAL', e); process.exit(1); });
