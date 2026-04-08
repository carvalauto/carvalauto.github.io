var GH_TOKEN = '';
var GH_REPO = 'carvalauto/carvalauto.github.io';
var GH_FILE = 'products.json';

chrome.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
    if (msg.action === 'syncProducts') {
        syncToGitHub(msg.products).then(r => sendResponse(r)).catch(e => sendResponse({success: false, error: e.message}));
        return true;
    }
    if (msg.action === 'collectProduct') {
        // 采集逻辑由content script处理
    }
});

async function syncToGitHub(products) {
    if (!GH_TOKEN) {
        GH_TOKEN = localStorage.getItem('gh_token') || '';
    }
    if (!GH_TOKEN) {
        throw new Error('请先在插件设置中配置GitHub Token');
    }
    
    // 获取当前products.json
    var r = await fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_FILE + '?t=' + Date.now(), {
        headers: {'Authorization': 'token ' + GH_TOKEN, 'Accept': 'application/vnd.github.v3+json'}
    });
    if (!r.ok) throw new Error('获取文件失败');
    var meta = await r.json();
    var content;
    try {
        content = JSON.parse(decodeURIComponent(escape(atob(meta.content.replace(/\n/g, '')))));
    } catch(e) {
        var rawR = await fetch(meta.download_url + '?t=' + Date.now());
        content = await rawR.json();
    }
    
    // 合并新商品
    var maxId = content.length ? Math.max(...content.map(p => p.id || 0)) : 0;
    products.forEach(p => {
        p.id = ++maxId;
        p.collectedAt = Date.now();
        content.push(p);
    });
    
    // 保存到GitHub
    var body = {
        message: 'Add ' + products.length + ' products via collector v1.6',
        content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
        sha: meta.sha
    };
    var updateR = await fetch('https://api.github.com/repos/' + GH_REPO + '/contents/' + GH_FILE, {
        method: 'PUT',
        headers: {'Authorization': 'token ' + GH_TOKEN, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
    if (!updateR.ok) {
        var err = await updateR.json();
        throw new Error(err.message || '保存失败');
    }
    return {success: true, count: products.length};
}
