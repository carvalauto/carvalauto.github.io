// ====== 0延迟实时更新系统 - 独立脚本 ======
(function() {
    'use strict';
    
    console.log('[实时更新] 0延迟实时更新系统启动中...');
    
    var currentVersion = 0;
    var checkInterval = null;
    var isInitialized = false;
    
    // 检查版本更新
    async function checkVersionUpdate() {
        try {
            const resp = await fetch('https://carvalauto-products.oss-cn-hangzhou.aliyuncs.com/version.json?_=' + Date.now());
            if (resp.ok) {
                const data = await resp.json();
                if (data.version && data.version > currentVersion) {
                    console.log('[实时更新] 检测到版本更新:', currentVersion, '→', data.version);
                    currentVersion = data.version;
                    
                    // 清除缓存
                    localStorage.removeItem('carval_products_v2');
                    localStorage.removeItem('carval_products_cache');
                    localStorage.removeItem('cached_products');
                    
                    // 显示更新通知
                    showUpdateNotification('数据已更新，正在刷新...');
                    
                    // 重新加载页面
                    setTimeout(function() {
                        location.reload();
                    }, 2000);
                }
            }
        } catch(e) {
            console.log('[实时更新] 版本检查失败:', e);
        }
    }
    
    // 显示更新通知
    function showUpdateNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #28a745;
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-size: 14px;
            font-weight: 600;
            animation: slideDown 0.3s ease;
        `;
        notification.textContent = '✅ ' + message;
        document.body.appendChild(notification);
    }
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideDown {
            from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    `;
    document.head.appendChild(style);
    
    // 初始化版本检查
    function initVersionCheck() {
        if (isInitialized) {
            console.log('[实时更新] 已经初始化，跳过重复初始化');
            return;
        }
        
        // 先获取当前版本
        fetch('https://carvalauto-products.oss-cn-hangzhou.aliyuncs.com/version.json?_=' + Date.now())
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.version) {
                    currentVersion = data.version;
                    console.log('[实时更新] 当前版本:', currentVersion);
                    console.log('[实时更新] 系统已启动，每5秒检查一次更新');
                    
                    // 启动定时检查
                    checkInterval = setInterval(checkVersionUpdate, 5000);
                    isInitialized = true;
                } else {
                    // 如果获取失败，直接启动检查
                    console.log('[实时更新] 获取初始版本失败，直接启动检查');
                    checkInterval = setInterval(checkVersionUpdate, 5000);
                    isInitialized = true;
                }
            })
            .catch(function(e) {
                console.log('[实时更新] 获取初始版本失败，直接启动检查:', e);
                checkInterval = setInterval(checkVersionUpdate, 5000);
                isInitialized = true;
            });
    }
    
    // 页面加载完成后启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initVersionCheck);
    } else {
        initVersionCheck();
    }
    
    // 页面卸载时停止检查
    window.addEventListener('beforeunload', function() {
        if (checkInterval) {
            clearInterval(checkInterval);
            console.log('[实时更新] 版本检查已停止');
        }
    });
    
})();
