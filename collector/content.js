// content.js - 阿里巴巴产品采集器 v21
// 精准采集：标题、左侧缩略图主图、OEM编码、Compatible vehicles车型表格
// v21: 采集所有主图，不再限制为6张

(function() {
  'use strict';
  
  if (window.__alibabaCollectorInjected) return;
  window.__alibabaCollectorInjected = true;
  
  console.log('[采集器 v21] 已加载');
  
  // 创建按钮
  function createButton() {
    const btn = document.createElement('button');
    btn.id = 'alibaba-collect-btn';
    btn.textContent = '📦 采集到 GitHub';
    btn.style.cssText = `
      position: fixed; top: 50%; right: 20px; transform: translateY(-50%);
      z-index: 999999; padding: 14px 18px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white; border: none; border-radius: 25px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
    `;
    btn.addEventListener('click', handleCollect);
    return btn;
  }
  
  // 通知
  function notify(msg, type = 'info') {
    const colors = { success: '#d4edda', error: '#f8d7da', info: '#cce5ff' };
    const old = document.getElementById('alibaba-notify');
    if (old) old.remove();
    const div = document.createElement('div');
    div.id = 'alibaba-notify';
    div.style.cssText = `position:fixed;top:20px;right:20px;z-index:9999999;padding:15px 25px;background:${colors[type]};border-radius:8px;font-size:14px;max-width:90%;box-shadow:0 4px 12px rgba(0,0,0,0.15);white-space:pre-line;`;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 6000);
  }
  
  // 清理图片URL - 获取原图
  function cleanImageUrl(src) {
    if (!src) return null;
    if (src.startsWith('//')) src = 'https:' + src;
    // 阿里巴巴图片URL格式: xxx.jpg_50x50.jpg 或 xxx.jpg
    // 提取原图URL（去掉尺寸后缀）
    const match = src.match(/^(https?:\/\/[^_]+)\.(jpg|jpeg|png|webp)/i);
    if (match) {
      return match[1] + '.' + match[2];
    }
    // 备用：按 _ 分割
    const parts = src.split('_');
    if (parts.length > 1 && parts[0].match(/\.(jpg|jpeg|png|webp)$/i)) {
      return parts[0];
    }
    return src;
  }
  
  // 采集产品
  function collectProduct() {
    const product = {
      url: window.location.href.split('?')[0],
      title: '',
      oemCode: '',
      images: [],
      fitmentTable: [],
      collectedAt: new Date().toISOString()
    };
    
    // ========== 1. 标题 ==========
    const titleSelectors = [
      'h1[class*="title"]', 
      '.module-pdp-title h1', 
      '#mod-detail-title h1', 
      '.product-title', 
      'h1'
    ];
    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim().length > 5) {
        product.title = el.textContent.trim();
        break;
      }
    }
    console.log('[v11] 标题:', product.title);
    
    // ========== 2. 左侧缩略图主图采集（精准定位）==========
    const imageSet = new Set();
    
    console.log('[v11] ===== 开始采集图片 =====');
    
    // 方法1: 直接查找所有产品图片（最直接）
    // 阿里巴巴产品图片通常在画廊区域
    const gallerySelectors = [
      // 缩略图列表
      '.detail-gallery-preview .items img',
      '.detail-gallery-preview img',
      '.thumb-list img', 
      '.thumb-item img',
      '.pics-item img',
      // 主图区域
      '.detail-gallery-img img',
      '.main-pic img',
      '.main-image img',
      // 画廊容器
      '[class*="gallery"] img',
      '[class*="thumb"] img',
      // 通用产品图片
      '.product-img img',
      '.product-image img'
    ];
    
    for (const sel of gallerySelectors) {
      const imgs = document.querySelectorAll(sel);
      console.log(`[v11] 选择器 ${sel}: 找到 ${imgs.length} 张图片`);
      
      imgs.forEach((img, idx) => {
        let src = img.src || img.dataset.src || img.dataset.original || '';
        const width = img.naturalWidth || img.width || 0;
        const height = img.naturalHeight || img.height || 0;
        
        console.log(`[v11]   图片${idx}: src=${src.substring(0, 60)}... size=${width}x${height}`);
        
        if (src && (src.includes('alicdn.com') || src.includes('alibaba.com') || src.includes('1688.com'))) {
          // 过滤太小的图片（logo、图标等）
          if (width >= 40 && height >= 40) {
            src = cleanImageUrl(src);
            if (src && src.length > 30 && !imageSet.has(src)) {
              imageSet.add(src);
              console.log(`[v11]   ✅ 已采集: ${src.substring(0, 50)}...`);
            }
          } else {
            console.log(`[v11]   ❌ 尺寸太小，跳过`);
          }
        }
      });
      
      // 采集所有符合条件的图片，不限制数量
      if (imageSet.size > 0) {
        console.log(`[v17] 已采集 ${imageSet.size} 张主图`);
      }
    }
    
    // 方法2: 如果上面没找到，尝试通过图片尺寸判断
    if (imageSet.size === 0) {
      console.log('[v11] 缩略图列表未找到，尝试按尺寸筛选');
      const allImages = document.querySelectorAll('img');
      let candidateImages = [];
      
      allImages.forEach(img => {
        let src = img.src || img.dataset.src || '';
        const w = img.naturalWidth || img.width || 0;
        const h = img.naturalHeight || img.height || 0;
        
        if (src && (src.includes('alicdn.com') || src.includes('alibaba.com'))) {
          // 产品图片通常是正方形或接近正方形
          if (w >= 100 && h >= 100 && w <= 1000 && h <= 1000) {
            candidateImages.push({
              src: cleanImageUrl(src),
              size: w * h,
              ratio: Math.min(w, h) / Math.max(w, h)
            });
          }
        }
      });
      
      // 按尺寸排序，取最大的几张
      candidateImages.sort((a, b) => b.size - a.size);
      candidateImages.slice(0, 6).forEach(item => {
        if (item.src && !imageSet.has(item.src)) {
          imageSet.add(item.src);
          console.log(`[v11] 尺寸筛选: ${item.src.substring(0, 50)}...`);
        }
      });
    }
    
    product.images = Array.from(imageSet);
    console.log('[v17] 共采集到', product.images.length, '张主图（全部采集）');
    
    // ========== 3. Compatible vehicles 车型表格 ==========
    // 先查找 "Compatible vehicles" 标题
    const allElements = document.querySelectorAll('h2, h3, h4, div[class*="title"], span[class*="title"]');
    let foundVehicleSection = false;
    
    for (const el of allElements) {
      const text = el.textContent.toLowerCase();
      if (text.includes('compatible vehicle') || text.includes('fitment') || text.includes('application')) {
        console.log('[v11] 找到车型区域:', el.textContent);
        foundVehicleSection = true;
        // 找到该标题后面的表格
        let nextEl = el.nextElementSibling;
        let attempts = 0;
        while (nextEl && attempts < 5) {
          if (nextEl.tagName === 'TABLE') {
            parseVehicleTable(nextEl, product);
            break;
          }
          // 检查子元素中的表格
          const tableInChild = nextEl.querySelector('table');
          if (tableInChild) {
            parseVehicleTable(tableInChild, product);
            break;
          }
          nextEl = nextEl.nextElementSibling;
          attempts++;
        }
        if (product.fitmentTable.length > 0) break;
      }
    }
    
    // 如果没找到标题，尝试通过表头识别
    if (product.fitmentTable.length === 0) {
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const headerRow = table.querySelector('tr');
        if (headerRow) {
          const headerText = headerRow.textContent.toLowerCase();
          if (headerText.includes('make') && headerText.includes('model') && headerText.includes('year')) {
            console.log('[v11] 通过表头识别车型表格');
            parseVehicleTable(table, product);
            if (product.fitmentTable.length > 0) break;
          }
        }
      }
    }
    
    console.log('[v11] 车型表格:', product.fitmentTable.length, '条');
    
    // ========== 4. OEM编码 ==========
    // 从产品参数表格中提取
    const paramTables = document.querySelectorAll('table');
    for (const table of paramTables) {
      const rows = table.querySelectorAll('tr');
      for (const row of rows) {
        const cells = row.querySelectorAll('td, th');
        if (cells.length >= 2) {
          const label = cells[0].textContent.toLowerCase().trim();
          const value = cells[cells.length - 1].textContent.trim();
          // 匹配 OE NO. / Model Number / OEM Number 等
          if ((label.includes('oe no') || label.includes('oem') || label.includes('model number') || label.includes('part number')) 
              && !label.includes('brand') && !label.includes('place')) {
            if (value && value.length >= 3 && value.length <= 60 && value !== label) {
              product.oemCode = value;
              console.log('[v11] OEM编码:', product.oemCode, '(来源:', label, ')');
              break;
            }
          }
        }
      }
      if (product.oemCode) break;
    }
    
    // 如果没找到，从标题中提取
    if (!product.oemCode && product.title) {
      // 匹配格式如：90919-02240, 9091902240, 19070-B1011 等
      const oemPatterns = [
        /(\d{5}-\d{5})/gi,           // 90919-02240
        /(\d{10})/g,                  // 9091902240
        /([A-Z0-9]{4,6}[-]\d{4,6})/gi, // 19070-B1011
        /([A-Z]{2,4}\d{6,10})/gi      // 其他OEM格式
      ];
      for (const pattern of oemPatterns) {
        const match = product.title.match(pattern);
        if (match) {
          product.oemCode = match[0].toUpperCase();
          console.log('[v11] 从标题提取OEM:', product.oemCode);
          break;
        }
      }
    }
    
    console.log('[v11] 最终OEM:', product.oemCode || '未找到');
    return product;
  }
  
  // 解析车型表格
  function parseVehicleTable(table, product) {
    const rows = table.querySelectorAll('tr');
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cells = row.querySelectorAll('td');
      
      // 跳过表头行
      if (i === 0 && cells.length === 0) continue;
      
      if (cells.length >= 2) {
        const make = cells[0]?.textContent?.trim() || '';
        const model = cells[1]?.textContent?.trim() || '';
        
        // 过滤无效数据
        if (make && model && make.length < 30 && model.length < 50) {
          // 排除非车型数据
          const invalidKeywords = ['Main sales', 'Operation', 'Composition', 'Usage', 'Color', 'Place', 'Brand', 'Type', 'Warranty', 'Condition'];
          if (!invalidKeywords.some(k => make.includes(k))) {
            product.fitmentTable.push({
              make: make,
              model: model,
              year: cells[2]?.textContent?.trim() || '',
              engine: cells[3]?.textContent?.trim() || ''
            });
          }
        }
      }
    }
  }
  
  // 处理采集
  async function handleCollect() {
    notify('⏳ 采集中...', 'info');
    try {
      const product = collectProduct();
      
      // 验证必要字段
      const warnings = [];
      if (!product.title) warnings.push('标题未找到');
      if (product.images.length === 0) warnings.push('图片未找到');
      if (!product.oemCode) warnings.push('OEM编码未找到');
      if (product.fitmentTable.length === 0) warnings.push('车型表格未找到');
      
      if (!product.title) {
        notify('❌ 未找到产品标题，无法采集', 'error');
        return;
      }
      
      // 显示采集结果
      const resultMsg = `采集完成！
图片: ${product.images.length} 张
OEM: ${product.oemCode || '无'}
车型: ${product.fitmentTable.length} 条
${warnings.length > 0 ? '⚠️ ' + warnings.join(', ') : ''}
⏳ 正在推送...`;
      
      notify(resultMsg, 'info');
      
      // 异步发送消息
      try {
        const response = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({ type: 'PUSH_PRODUCTS', products: [product] }, (r) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(r);
            }
          });
        });
        
        if (response?.success) {
          notify(`✅ 成功推送到 GitHub！
当前总计: ${response.totalCount} 个产品`, 'success');
        } else {
          notify('❌ 推送失败: ' + (response?.error || '未知错误'), 'error');
        }
      } catch (err) {
        console.error('[v21] 消息发送失败:', err);
        notify('❌ 消息传递失败: ' + err.message, 'error');
      }
    } catch (e) {
      notify('❌ 采集错误: ' + e.message, 'error');
      console.error('[v21] 错误:', e);
    }
  }
  
  function init() {
    const old = document.getElementById('alibaba-collect-btn');
    if (old) old.remove();
    document.body.appendChild(createButton());
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // 监听页面变化
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(init, 1000);
    }
  }).observe(document, { subtree: true, childList: true });
})();

