// ===== GA4 配置 =====
function openGaSettings() {
    document.getElementById('gaMeasurementId').value = localStorage.getItem('ga_measurement_id') || '';
    document.getElementById('gaApiSecret').value = localStorage.getItem('ga_api_secret') || '';
    document.getElementById('gaSettingsModal').classList.add('active');
}

function closeGaSettings() {
    document.getElementById('gaSettingsModal').classList.remove('active');
}

function saveGaSettings() {
    const measurementId = document.getElementById('gaMeasurementId').value.trim();
    if (!measurementId) {
        showToast('⚠ 请填写 GA4 Measurement ID', '#e74c3c');
        return;
    }
    localStorage.setItem('ga_measurement_id', measurementId);
    localStorage.setItem('ga_api_secret', document.getElementById('gaApiSecret').value.trim());
    closeGaSettings();
    showToast('✓ GA4 配置已保存', '#2ecc71');
    initAnalytics();
}

// ===== 流量分析 =====
function initAnalytics() {
    const gaMeasurementId = localStorage.getItem('ga_measurement_id');
    
    // 检查 GA4 配置
    if (!gaMeasurementId) {
        document.getElementById('gaConfigAlert').style.display = 'block';
        loadMockAnalyticsData();
        return;
    }
    
    document.getElementById('gaConfigAlert').style.display = 'none';
    loadGa4Data();
}

// 加载模拟数据（没有配置 GA4 时）
function loadMockAnalyticsData() {
    // 实时数据
    document.getElementById('totalVisitors').textContent = Math.floor(Math.random() * 50000) + 10000;
    document.getElementById('realtimeUsers').textContent = Math.floor(Math.random() * 50) + 5;
    document.getElementById('dailyUsers').textContent = Math.floor(Math.random() * 500) + 100;
    document.getElementById('totalSessions').textContent = Math.floor(Math.random() * 5000) + 1000;
    document.getElementById('bounceRate').textContent = (Math.random() * 40 + 30).toFixed(1) + '%';
    document.getElementById('avgSessionDuration').textContent = Math.floor(Math.random() * 300 + 60) + 's';
    document.getElementById('conversionRate').textContent = (Math.random() * 5 + 1).toFixed(2) + '%';

    // 流量趋势图
    const trafficCtx = document.getElementById('trafficChart');
    if (trafficCtx && !trafficCtx.chart) {
        trafficCtx.chart = new Chart(trafficCtx, {
            type: 'line',
            data: {
                labels: ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'],
                datasets: [{
                    label: '访问量',
                    data: [120, 150, 180, 160, 200, 220, 190],
                    borderColor: '#0f4c81',
                    backgroundColor: 'rgba(15, 76, 129, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true, labels: { font: { family: "'Roboto', sans-serif" } } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { font: { family: "'Roboto', sans-serif" } } },
                    x: { ticks: { font: { family: "'Roboto', sans-serif" } } }
                }
            }
        });
    }

    // 来源分布
    const sourceCtx = document.getElementById('sourceChart');
    if (sourceCtx && !sourceCtx.chart) {
        sourceCtx.chart = new Chart(sourceCtx, {
            type: 'doughnut',
            data: {
                labels: ['Organic Search', 'Direct', 'Social Media', 'Referral'],
                datasets: [{
                    data: [45, 25, 20, 10],
                    backgroundColor: ['#0f4c81', '#e63946', '#2ecc71', '#f39c12']
                }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }

    // 地理分布
    const regionCtx = document.getElementById('regionChart');
    if (regionCtx && !regionCtx.chart) {
        regionCtx.chart = new Chart(regionCtx, {
            type: 'doughnut',
            data: {
                labels: ['美国', '中国', '印度', '法国', '其他'],
                datasets: [{
                    data: [35, 25, 15, 12, 13],
                    backgroundColor: ['#0f4c81', '#e63946', '#2ecc71', '#f39c12', '#3498db']
                }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }

    // 热门产品
    const topProducts = [
        { rank: 1, name: 'Brake Pad Set (90919-01253)', views: 1250, duration: '3m 45s', bounce: '32%' },
        { rank: 2, name: 'Oil Filter (90915-10003)', views: 980, duration: '2m 30s', bounce: '38%' },
        { rank: 3, name: 'Air Filter (90919-02050)', views: 850, duration: '2m 15s', bounce: '42%' },
        { rank: 4, name: 'Spark Plug (90919-01253)', views: 720, duration: '2m 10s', bounce: '45%' },
        { rank: 5, name: 'Transmission Filter', views: 650, duration: '1m 50s', bounce: '48%' }
    ];
    document.getElementById('topProductsTable').innerHTML = topProducts.map(p => `
        <tr>
            <td>${p.rank}</td>
            <td>${p.name}</td>
            <td>${p.views}</td>
            <td>${p.duration}</td>
            <td>${p.bounce}</td>
        </tr>
    `).join('');

    // 国家分布
    const topCountries = [
        { country: '美国', users: 1250, percentage: '35%' },
        { country: '中国', users: 890, percentage: '25%' },
        { country: '印度', users: 530, percentage: '15%' },
        { country: '法国', users: 425, percentage: '12%' },
        { country: '英国', users: 380, percentage: '11%' },
        { country: '德国', users: 320, percentage: '9%' },
        { country: '日本', users: 280, percentage: '8%' },
        { country: '加拿大', users: 250, percentage: '7%' },
        { country: '澳大利亚', users: 220, percentage: '6%' },
        { country: '新加坡', users: 180, percentage: '5%' }
    ];
    document.getElementById('topCountriesList').innerHTML = topCountries.map(c => `
        <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
            <span><strong>${c.country}</strong></span>
            <span style="color: #888;">${c.users} 访客 (${c.percentage})</span>
        </div>
    `).join('');

    // 搜索关键词
    const topKeywords = [
        { keyword: '90919-01253', searches: 450 },
        { keyword: 'Toyota brake pad', searches: 380 },
        { keyword: 'OEM auto parts', searches: 320 },
        { keyword: '90915-10003', searches: 280 },
        { keyword: 'Replacement filters', searches: 250 },
        { keyword: 'Car parts supplier', searches: 220 },
        { keyword: '汽车配件', searches: 180 },
        { keyword: 'Engine oil filter', searches: 160 },
        { keyword: 'Air filter replacement', searches: 140 },
        { keyword: 'Spark plugs', searches: 120 }
    ];
    document.getElementById('topKeywordsList').innerHTML = topKeywords.map(k => `
        <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
            <span><strong>${k.keyword}</strong></span>
            <span style="background: var(--primary); color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px;">${k.searches} 次</span>
        </div>
    `).join('');
}

// 加载 GA4 真实数据（需要后端支持）
async function loadGa4Data() {
    try {
        // 调用后端 API 获取 GA4 数据
        const response = await fetch('/api/ga4-data', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
            const data = await response.json();
            // 更新实时数据
            document.getElementById('totalVisitors').textContent = data.totalVisitors || '-';
            document.getElementById('realtimeUsers').textContent = data.realtimeUsers || '-';
            document.getElementById('dailyUsers').textContent = data.dailyUsers || '-';
            document.getElementById('totalSessions').textContent = data.totalSessions || '-';
            document.getElementById('bounceRate').textContent = data.bounceRate || '-';
            document.getElementById('avgSessionDuration').textContent = data.avgSessionDuration || '-';
            document.getElementById('conversionRate').textContent = data.conversionRate || '-';
            
            // 更新热门产品
            if (data.topProducts) {
                document.getElementById('topProductsTable').innerHTML = data.topProducts.map((p, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${p.name}</td>
                        <td>${p.views}</td>
                        <td>${p.duration}</td>
                        <td>${p.bounce}</td>
                    </tr>
                `).join('');
            }
            
            // 更新国家分布
            if (data.topCountries) {
                document.getElementById('topCountriesList').innerHTML = data.topCountries.map(c => `
                    <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                        <span><strong>${c.country}</strong></span>
                        <span style="color: #888;">${c.users} 访客 (${c.percentage})</span>
                    </div>
                `).join('');
            }
            
            // 更新搜索关键词
            if (data.topKeywords) {
                document.getElementById('topKeywordsList').innerHTML = data.topKeywords.map(k => `
                    <div style="padding: 10px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                        <span><strong>${k.keyword}</strong></span>
                        <span style="background: var(--primary); color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px;">${k.searches} 次</span>
                    </div>
                `).join('');
            }
        } else {
            loadMockAnalyticsData();
        }
    } catch (e) {
        console.error('GA4 数据加载失败:', e);
        loadMockAnalyticsData();
    }
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    // 当切换到分析页面时初始化
    const analyticsTab = document.querySelector('[onclick*="showPage(\'analytics\')"]');
    if (analyticsTab) {
        analyticsTab.addEventListener('click', function() {
            setTimeout(initAnalytics, 100);
        });
    }
});
