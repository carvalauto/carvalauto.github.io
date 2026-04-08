var GH_REPO = 'carvalauto/carvalauto.github.io';
var GH_FILE = 'products.json';

function log(msg) {
    var el = document.getElementById('log');
    el.innerHTML = new Date().toLocaleTimeString() + ': ' + msg + '<br>' + el.innerHTML;
}

function setStatus(msg, type) {
    document.getElementById('status').textContent = msg;
    document.getElementById('status').className = 'status ' + type;
}

function updateCount(c) {
    document.getElementById('count').textContent = c;
    localStorage.setItem('collected_count', c);
}

document.getElementById('collectBtn').onclick = function() {
    setStatus('正在采集...', 'info');
    log('从当前页面采集商品');
    chrome.tabs.query({active: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {action: 'collectProduct'}, function(r) {
            if (r && r.success) {
                setStatus('采集成功!', 'success');
                updateCount((parseInt(localStorage.getItem('collected_count') || '0')) + 1);
                log('商品已添加到列表');
            } else {
                setStatus('采集失败: ' + (r && r.error || '未知错误'), 'error');
            }
        });
    });
};

document.getElementById('syncBtn').onclick = async function() {
    setStatus('正在同步...', 'info');
    var products = JSON.parse(localStorage.getItem('pending_products') || '[]');
    if (products.length === 0) {
        setStatus('没有待同步商品', 'error');
        return;
    }
    log('同步 ' + products.length + ' 个商品');
    // 使用消息传递给background.js处理
    chrome.runtime.sendMessage({action: 'syncProducts', products: products}, function(r) {
        if (r && r.success) {
            setStatus('同步成功!', 'success');
            updateCount(0);
            localStorage.setItem('pending_products', '[]');
            log('商品已同步到GitHub');
        } else {
            setStatus('同步失败', 'error');
        }
    });
};

document.getElementById('clearBtn').onclick = function() {
    if (confirm('确定清空采集列表?')) {
        localStorage.setItem('pending_products', '[]');
        updateCount(0);
        setStatus('已清空', 'info');
        log('列表已清空');
    }
};

// 初始化
updateCount(parseInt(localStorage.getItem('collected_count') || '0'));
