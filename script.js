// ========== CDP Monitor — Interactive Dashboard ==========
(function () {
    'use strict';

    // --- DOM References ---
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const overlay = document.getElementById('overlay');
    const themeToggle = document.getElementById('themeToggle');
    const refreshBtn = document.getElementById('refreshBtn');
    const notificationBtn = document.getElementById('notificationBtn');
    const notificationPanel = document.getElementById('notificationPanel');
    const markAllRead = document.getElementById('markAllRead');
    const toastContainer = document.getElementById('toastContainer');
    const timeRange = document.getElementById('timeRange');
    const navItems = document.querySelectorAll('.nav-item');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const activityItems = document.querySelectorAll('.activity-item');

    // --- Sidebar Toggle ---
    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
    });
    if (localStorage.getItem('sidebar-collapsed') === 'true') sidebar.classList.add('collapsed');

    // --- Mobile Menu ---
    mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        overlay.classList.toggle('active');
    });
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('mobile-open');
        overlay.classList.remove('active');
        notificationPanel.classList.remove('open');
    });

    // --- Navigation ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            const page = item.dataset.page;
            document.getElementById('pageTitle').textContent =
                page.charAt(0).toUpperCase() + page.slice(1);
            showToast('info', `Navigated to ${page}`);
        });
    });

    // --- Notification Panel ---
    notificationBtn.addEventListener('click', () => {
        notificationPanel.classList.toggle('open');
        overlay.classList.toggle('active');
    });
    markAllRead.addEventListener('click', () => {
        document.querySelectorAll('.notification-item.unread').forEach(n => n.classList.remove('unread'));
        document.querySelector('.notification-count').style.display = 'none';
        showToast('success', 'All notifications marked as read');
    });

    // --- Refresh ---
    refreshBtn.addEventListener('click', () => {
        refreshBtn.classList.add('spin');
        setTimeout(() => refreshBtn.classList.remove('spin'), 800);
        animateMetrics();
        updateCharts();
        showToast('success', 'Dashboard data refreshed');
    });

    // --- Time Range ---
    timeRange.addEventListener('click', (e) => {
        if (!e.target.classList.contains('time-btn')) return;
        timeRange.querySelectorAll('.time-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        updateCharts();
        showToast('info', `Time range: ${e.target.dataset.range}`);
    });

    // --- Activity Filters ---
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.dataset.filter;
            activityItems.forEach(item => {
                if (filter === 'all' || item.dataset.type === filter) {
                    item.classList.remove('hidden');
                } else {
                    item.classList.add('hidden');
                }
            });
        });
    });

    // --- Toast System ---
    function showToast(type, message) {
        const icons = { success: 'fa-check-circle', info: 'fa-info-circle', warning: 'fa-exclamation-triangle', error: 'fa-times-circle' };
        const colors = { success: 'var(--green)', info: 'var(--cyan)', warning: 'var(--orange)', error: 'var(--red)' };
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <i class="fas ${icons[type]} toast-icon" style="color:${colors[type]}"></i>
            <span class="toast-message">${message}</span>
        `;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('out');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- Animated Counter ---
    function animateCounter(el, target, suffix) {
        const duration = 1500;
        const start = performance.now();
        const from = 0;
        function tick(now) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(from + (target - from) * eased);
            el.textContent = current + suffix;
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // --- Animate Metric Cards ---
    function animateMetrics() {
        const metrics = [
            { id: 'metricCpu', target: rand(40, 85), suffix: '%', fillClass: 'cpu-fill' },
            { id: 'metricMemory', target: rand(55, 92), suffix: '%', fillClass: 'memory-fill' },
            { id: 'metricDisk', target: rand(30, 65), suffix: '%', fillClass: 'disk-fill' },
            { id: 'metricNetwork', target: rand(50, 200), suffix: ' Mb/s', fillClass: 'network-fill' },
        ];
        metrics.forEach(m => {
            const card = document.getElementById(m.id);
            const valueEl = card.querySelector('.metric-value');
            const fillEl = card.querySelector('.metric-bar-fill');
            animateCounter(valueEl, m.target, m.suffix);
            const pct = m.id === 'metricNetwork' ? Math.min(m.target / 2, 100) : m.target;
            fillEl.style.width = pct + '%';
            // Update trend
            const trendEl = card.querySelector('.metric-trend');
            const trendVal = rand(-20, 25);
            trendEl.className = 'metric-trend ' + (trendVal >= 0 ? 'up' : 'down');
            trendEl.innerHTML = `<i class="fas fa-arrow-${trendVal >= 0 ? 'up' : 'down'}"></i> ${Math.abs(trendVal)}%`;
        });
    }

    function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    // --- Charts ---
    let perfChart, resChart;

    function generateData(points, min, max) {
        const data = [];
        let val = rand(min, max);
        for (let i = 0; i < points; i++) {
            val += rand(-8, 8);
            val = Math.max(min, Math.min(max, val));
            data.push(val);
        }
        return data;
    }

    function getLabels(count) {
        const labels = [];
        const now = new Date();
        for (let i = count - 1; i >= 0; i--) {
            const d = new Date(now - i * 5 * 60000);
            labels.push(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
        return labels;
    }

    function createGradient(ctx, color, h) {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, color.replace(')', ',0.3)').replace('rgb', 'rgba'));
        g.addColorStop(1, color.replace(')', ',0.01)').replace('rgb', 'rgba'));
        return g;
    }

    const chartDefaults = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: '#1c1e2e',
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
                titleFont: { family: 'Inter', size: 12 },
                bodyFont: { family: 'Inter', size: 11 },
                padding: 12,
                cornerRadius: 8,
                displayColors: true,
                boxPadding: 4,
            }
        }
    };

    function initPerformanceChart() {
        const ctx = document.getElementById('performanceChart').getContext('2d');
        const labels = getLabels(24);
        perfChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'CPU',
                        data: generateData(24, 30, 80),
                        borderColor: '#7c5cfc',
                        backgroundColor: createGradient(ctx, 'rgb(124,92,252)', 260),
                        borderWidth: 2, fill: true, tension: 0.4,
                        pointRadius: 0, pointHoverRadius: 5,
                        pointHoverBackgroundColor: '#7c5cfc',
                    },
                    {
                        label: 'Memory',
                        data: generateData(24, 50, 90),
                        borderColor: '#22d3ee',
                        backgroundColor: createGradient(ctx, 'rgb(34,211,238)', 260),
                        borderWidth: 2, fill: true, tension: 0.4,
                        pointRadius: 0, pointHoverRadius: 5,
                        pointHoverBackgroundColor: '#22d3ee',
                    },
                    {
                        label: 'Network',
                        data: generateData(24, 10, 60),
                        borderColor: '#34d399',
                        backgroundColor: 'transparent',
                        borderWidth: 2, fill: false, tension: 0.4,
                        pointRadius: 0, pointHoverRadius: 5,
                        borderDash: [6, 3],
                        pointHoverBackgroundColor: '#34d399',
                    }
                ]
            },
            options: {
                ...chartDefaults,
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: { color: '#6b7280', font: { size: 10, family: 'Inter' }, maxTicksLimit: 8 },
                        border: { display: false }
                    },
                    y: {
                        min: 0, max: 100,
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        ticks: { color: '#6b7280', font: { size: 10, family: 'Inter' }, callback: v => v + '%' },
                        border: { display: false }
                    }
                },
                animation: { duration: 1200, easing: 'easeOutQuart' }
            }
        });
    }

    function initResourceChart() {
        const ctx = document.getElementById('resourceChart').getContext('2d');
        resChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['CPU', 'Memory', 'Storage', 'Network', 'Free'],
                datasets: [{
                    data: [25, 30, 15, 10, 20],
                    backgroundColor: ['#7c5cfc', '#22d3ee', '#fb923c', '#34d399', '#252840'],
                    borderColor: '#1c1e2e',
                    borderWidth: 3,
                    hoverOffset: 8,
                }]
            },
            options: {
                ...chartDefaults,
                cutout: '72%',
                plugins: {
                    ...chartDefaults.plugins,
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            color: '#9ca3af',
                            font: { size: 11, family: 'Inter' },
                            padding: 16,
                            usePointStyle: true,
                            pointStyleWidth: 8,
                        }
                    }
                },
                animation: { animateRotate: true, duration: 1500, easing: 'easeOutQuart' }
            }
        });
    }

    function updateCharts() {
        if (perfChart) {
            perfChart.data.labels = getLabels(24);
            perfChart.data.datasets[0].data = generateData(24, 30, 80);
            perfChart.data.datasets[1].data = generateData(24, 50, 90);
            perfChart.data.datasets[2].data = generateData(24, 10, 60);
            perfChart.update('active');
        }
        if (resChart) {
            const d = [rand(15, 35), rand(20, 40), rand(10, 25), rand(5, 20)];
            d.push(100 - d.reduce((a, b) => a + b, 0));
            resChart.data.datasets[0].data = d;
            resChart.update('active');
        }
    }

    // --- Server Row Hover Effects ---
    document.querySelectorAll('.server-item').forEach(item => {
        item.addEventListener('click', () => {
            const name = item.querySelector('.server-name').textContent;
            showToast('info', `Opening details for ${name}`);
        });
    });

    // --- Search ---
    const searchInput = document.getElementById('searchInput');
    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
        }
        if (e.key === 'Escape') {
            searchInput.blur();
            notificationPanel.classList.remove('open');
            overlay.classList.remove('active');
            sidebar.classList.remove('mobile-open');
        }
    });

    // --- Export Button ---
    document.getElementById('exportBtn').addEventListener('click', () => {
        showToast('success', 'Report exported successfully');
    });

    // --- Live Data Simulation ---
    function simulateLiveData() {
        animateMetrics();
        setInterval(() => {
            updateCharts();
            animateMetrics();
        }, 15000);
    }

    // --- Intersection Observer for staggered entry ---
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, i) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, i * 80);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.metric-card, .chart-card, .status-card, .activity-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity .6s ease, transform .6s ease';
        observer.observe(el);
    });

    // --- Init ---
    function init() {
        initPerformanceChart();
        initResourceChart();
        simulateLiveData();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
