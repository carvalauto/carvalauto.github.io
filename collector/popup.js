// popup.js - 设置页面脚本 v20 (数据同步版)

document.addEventListener('DOMContentLoaded', () => {
  const tokenInput = document.getElementById('token');
  const repoInput = document.getElementById('repo');
  const fileInput = document.getElementById('file');
  const saveBtn = document.getElementById('saveBtn');
  const statusDiv = document.getElementById('status');
  const pendingCount = document.getElementById('pendingCount');
  const totalCount = document.getElementById('totalCount');
  const syncStatus = document.getElementById('syncStatus');
  
  // 更新同步状态显示
  function updateSyncStatus(message, type) {
    if (syncStatus) {
      syncStatus.textContent = message;
      syncStatus.className = 'status ' + (type || 'info');
      syncStatus.style.display = 'block';
    }
  }
  
  // 更新计数
  function updateCounts() {
    chrome.storage.local.get(['pending_products', 'collected_count'], (result) => {
      const pending = result.pending_products ? JSON.parse(result.pending_products).length : 0;
      pendingCount.textContent = pending;
    });
  }
  
  // 获取 GitHub 上的总数（使用 CDN 优先，GitHub API 备用）
  async function fetchTotalCount() {
    try {
      // 方案1: 使用 jsDelivr CDN
      let resp = await fetch('https://cdn.jsdelivr.net/gh/carvalauto/carvalauto.github.io@main/products.json?t=' + Date.now());
      
      // 方案2: 如果 CDN 失败，尝试 GitHub API
      if (!resp.ok) {
        const token = await new Promise(resolve => {
          chrome.storage.local.get(['gh_token'], result => resolve(result.gh_token || ''));
        });
        
        resp = await fetch('https://api.github.com/repos/carvalauto/carvalauto.github.io/contents/products.json', {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });
        
        if (resp.ok) {
          const data = await resp.json();
          const content = atob(data.content);
          const products = JSON.parse(content);
          totalCount.textContent = products.length;
          updateSyncStatus('✅ 数据同步正常', 'success');
          return;
        }
      } else {
        const data = await resp.json();
        if (Array.isArray(data)) {
          totalCount.textContent = data.length;
          updateSyncStatus('✅ CDN 连接正常', 'success');
          return;
        }
      }
    } catch (e) {
      console.log('获取总数失败:', e);
    }
    totalCount.textContent = '?';
    updateSyncStatus('⚠️ 连接异常，请检查网络', 'error');
  }
  
  updateCounts();
  fetchTotalCount();
  
  // 监听数据同步消息
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.carval_sync_message) {
      const message = changes.carval_sync_message.newValue;
      if (message) {
        try {
          const data = JSON.parse(message);
          console.log('[Popup] 收到同步消息:', data);
          if (data.type === 'products_updated') {
            updateSyncStatus('🔄 检测到数据更新，正在刷新...', 'info');
            fetchTotalCount();
            updateCounts();
          }
        } catch (e) {}
      }
    }
  });
  
  // 加载已保存的配置
  chrome.runtime.sendMessage({ type: 'GET_CONFIG' }, (response) => {
    if (response && response.hasToken) {
      tokenInput.placeholder = '****已配置';
    }
    if (response) {
      repoInput.value = response.repo || 'carvalauto/carvalauto.github.io';
      fileInput.value = response.file || 'products.json';
    }
  });
  
  // 保存配置
  saveBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    const repo = repoInput.value.trim();
    const file = fileInput.value.trim();
    
    if (!token && !tokenInput.placeholder.includes('****')) {
      showStatus('请输入 GitHub Token', 'error');
      return;
    }
    
    chrome.runtime.sendMessage({
      type: 'SAVE_CONFIG',
      token: token,
      repo: repo,
      file: file
    }, (response) => {
      if (response && response.success) {
        showStatus('✅ 配置已保存！', 'success');
        tokenInput.value = '';
        tokenInput.placeholder = '****已配置';
        updateSyncStatus('✅ 配置已更新', 'success');
      } else {
        showStatus('❌ 保存失败: ' + (response?.error || '未知错误'), 'error');
      }
    });
  });
  
  function showStatus(msg, type) {
    statusDiv.textContent = msg;
    statusDiv.className = 'status ' + type;
    statusDiv.style.display = 'block';
    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
  
  // 定期更新计数和状态
  setInterval(updateCounts, 5000);
  setInterval(fetchTotalCount, 10000);
});
