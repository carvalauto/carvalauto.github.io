// background.js - GitHub API 推送服务 v20 (数据同步修复版)
// 修复数据同步问题，确保采集后前端页面能立即刷新
// v20 更新: 添加数据变化广播，通知前端页面实时更新

const GH_REPO = 'carvalauto/carvalauto.github.io';
const GH_FILE = 'products.json';
const GH_BRANCH = 'main';

// ===== 数据同步广播系统 =====
function broadcastDataChange(action, productId) {
    // 使用 chrome.storage.local 作为消息传递媒介
    // 因为 service worker 不能使用 BroadcastChannel
    const payload = {
        type: 'products_updated',
        action: action,
        productId: productId,
        timestamp: Date.now(),
        source: 'plugin'
    };
    
    chrome.storage.local.set({ carval_sync_message: JSON.stringify(payload) }, function() {
        // 触发后立即清除，确保下次相同消息仍能触发
        setTimeout(function() {
            chrome.storage.local.remove('carval_sync_message');
        }, 100);
    });
    
    console.log('[v20 Sync] 广播数据变化:', action, productId);
}

// 监听来自 popup 或 content 的同步请求
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'SYNC_PRODUCTS_UPDATED') {
        broadcastDataChange(request.action, request.productId);
        sendResponse({ success: true });
    }
    return true;
});

let config = { token: '', repo: GH_REPO, file: GH_FILE };

// 加载配置
async function loadConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['gh_token', 'gh_repo', 'gh_file'], (result) => {
      if (result.gh_token) config.token = result.gh_token;
      if (result.gh_repo) config.repo = result.gh_repo;
      if (result.gh_file) config.file = result.gh_file;
      console.log('[v20] 配置加载完成, token:', config.token ? '已设置' : '未设置');
      resolve();
    });
  });
}

// 保存配置
async function saveConfig(token, repo, file) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      gh_token: token,
      gh_repo: repo || GH_REPO,
      gh_file: file || GH_FILE
    }, resolve);
  });
}

// 获取文件SHA
async function getFileSha() {
  const url = `https://api.github.com/repos/${config.repo}/contents/${config.file}`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.v3+json'
    }
  });
  
  if (response.status === 404) {
    console.log('[v20] 文件不存在');
    return null;
  }
  
  if (!response.ok) {
    throw new Error(`获取SHA失败: ${response.status}`);
  }
  
  const data = await response.json();
  return data.sha;
}

// 获取文件内容（使用 CDN 优先，避免 GitHub API 大文件问题）
async function getFileContent() {
  try {
    // 方案1: 使用 jsDelivr CDN（最快最稳定）
    const cdnUrl = `https://cdn.jsdelivr.net/gh/${config.repo}@main/${config.file}?t=${Date.now()}`;
    const cdnResp = await fetch(cdnUrl);
    if (cdnResp.ok) {
      const data = await cdnResp.json();
      console.log('[v20] CDN 获取成功，产品数:', data.length);
      return Array.isArray(data) ? data : [];
    }
  } catch (e) {
    console.log('[v20] CDN 获取失败，尝试 GitHub API:', e.message);
  }
  
  try {
    // 方案2: GitHub API + download_url
    const url = `https://api.github.com/repos/${config.repo}/contents/${config.file}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${config.token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (response.status === 404) {
      return [];
    }
    
    if (!response.ok) {
      throw new Error(`获取文件失败: ${response.status}`);
    }
    
    const data = await response.json();
    
    // 大文件使用 download_url
    if (data.download_url) {
      const rawResp = await fetch(data.download_url + '?t=' + Date.now());
      const content = await rawResp.json();
      console.log('[v20] GitHub API 获取成功，产品数:', content.length);
      return Array.isArray(content) ? content : [];
    }
    
    // 小文件直接解码
    if (data.content) {
      const decoded = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ''))));
      const content = JSON.parse(decoded);
      return Array.isArray(content) ? content : [];
    }
  } catch (e) {
    console.error('[v20] GitHub API 获取失败:', e.message);
  }
  
  return [];
}

// 上传文件
async function uploadFile(content, sha) {
  const url = `https://api.github.com/repos/${config.repo}/contents/${config.file}`;
  
  console.log('[v20] 上传文件, 产品数量:', content.length);
  
  // 编码内容
  const contentStr = JSON.stringify(content, null, 2);
  const base64Content = btoa(unescape(encodeURIComponent(contentStr)));
  
  const body = {
    message: `Add products via Carval Collector v20 - ${new Date().toLocaleString()}`,
    content: base64Content,
    branch: GH_BRANCH
  };
  
  if (sha) {
    body.sha = sha;
  }
  
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('[v20] 上传失败:', errorText);
    throw new Error(`上传失败: ${response.status}`);
  }
  
  return await response.json();
}

// 自动分类
function detectCategory(title, fitmentTable) {
  const text = (title + ' ' + (fitmentTable || []).map(f => f.make || '').join(' ')).toLowerCase();
  
  if (text.includes('oil') || text.includes('润滑油') || text.includes('机油')) return 'oil';
  
  const japaneseBrands = ['toyota', 'honda', 'nissan', 'mazda', 'mitsubishi', 'subaru', 'lexus', 'infiniti', 'suzuki', 'daihatsu', 'isuzu'];
  if (japaneseBrands.some(b => text.includes(b))) return 'japanese';
  
  const koreanBrands = ['hyundai', 'kia', 'daewoo', 'ssangyong', 'genesis'];
  if (koreanBrands.some(b => text.includes(b))) return 'korean';
  
  const germanBrands = ['bmw', 'mercedes', 'audi', 'volkswagen', 'vw', 'porsche', 'opel'];
  if (germanBrands.some(b => text.includes(b))) return 'german';
  
  const chineseBrands = ['byd', 'geely', 'chery', 'great wall', 'haval', 'changan', 'gac', 'saic', 'baojun', 'wuling', 'hongguang'];
  if (chineseBrands.some(b => text.includes(b))) return 'chinese';
  
  return 'other';
}

// 构建 description
function buildDescription(product) {
  const parts = [];
  
  if (product.brand) {
    parts.push(`Brand: ${product.brand}`);
  }
  
  if (product.fitmentTable && product.fitmentTable.length > 0) {
    const makes = [...new Set(product.fitmentTable.map(f => f.make).filter(Boolean))];
    if (makes.length > 0) {
      parts.push(`Compatible with: ${makes.slice(0, 5).join(', ')}`);
    }
  }
  
  if (product.specs) {
    parts.push(`Specs: ${product.specs}`);
  }
  
  if (product.description) {
    parts.push(product.description);
  }
  
  if (parts.length === 0) {
    if (product.fitmentTable && product.fitmentTable.length > 0) {
      parts.push(`适配车型: ${product.fitmentTable.length}款`);
    } else {
      parts.push('OEM Auto Parts');
    }
  }
  
  return parts.join(' | ');
}

// 处理采集请求
async function handleCollect(product) {
  await loadConfig();
  
  if (!config.token) {
    return { success: false, error: '请先在设置中配置 GitHub Token' };
  }
  
  try {
    // 获取现有产品
    const existingProducts = await getFileContent();
    const sha = await getFileSha();
    
    // 生成ID
    const maxId = existingProducts.length > 0 ? Math.max(...existingProducts.map(p => p.id || 0)) : 0;
    const newId = maxId + 1;
    
    // 构建新产品
    const newProduct = {
      id: newId,
      name: product.title || product.name,
      title: product.title || product.name,
      category: detectCategory(product.title || '', product.fitmentTable),
      oem: product.oemCode || product.oem || '',
      oemCode: product.oemCode || product.oem || '',
      image: product.images ? product.images.join(',') : '',
      images: product.images || [],
      description: buildDescription(product),
      fitmentTable: product.fitmentTable || [],
      url: product.url,
      collectedAt: product.collectedAt || new Date().toISOString()
    };
    
    console.log('[v20] 新产品:', newProduct.name, 'ID:', newId);
    
    // 添加到列表
    existingProducts.push(newProduct);
    
    // 上传
    await uploadFile(existingProducts, sha);
    
    // ===== 关键：广播数据变化通知前端 =====
    broadcastDataChange('add', newId);
    
    return { success: true, id: newId, total: existingProducts.length };
  } catch (e) {
    console.error('[v20] 采集失败:', e);
    return { success: false, error: e.message };
  }
}

// 初始化
loadConfig();

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'COLLECT_PRODUCT') {
    handleCollect(request.product).then(sendResponse);
    return true;
  }
  
  if (request.type === 'GET_STATUS') {
    chrome.storage.local.get(['collected_count', 'pending_products'], (result) => {
      sendResponse({
        collected: result.collected_count || 0,
        pending: result.pending_products ? JSON.parse(result.pending_products).length : 0
      });
    });
    return true;
  }
  
  if (request.type === 'SAVE_CONFIG') {
    saveConfig(request.token, request.repo, request.file).then(() => {
      config.token = request.token;
      config.repo = request.repo;
      config.file = request.file;
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.type === 'GET_CONFIG') {
    sendResponse({
      hasToken: !!config.token,
      repo: config.repo,
      file: config.file
    });
    return true;
  }
});

console.log('[v20] Carval Collector Background Service 已启动 - 数据同步功能已启用');
