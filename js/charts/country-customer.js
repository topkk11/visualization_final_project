const CountryCustomerModule = (() => {
    let chart;
    let currentFilters = {};
    let metricMode = 'monetary'; // 'monetary' | 'frequency'
    let selectedSegment = 'all'; // 'all' | 'VIP' | 'Regular' | 'Low Value' | 'At Risk'

    const SEGMENTS = ['VIP', 'Regular', 'Low Value', 'At Risk'];
    const SEGMENT_COLORS = {
        'VIP': '#e74c3c',
        'Regular': '#3498db',
        'Low Value': '#95a5a6',
        'At Risk': '#f39c12'
    };

    async function init() {
        const container = document.getElementById('chart-country-customer');
        chart = echarts.init(container);

        // Metric toggle + Segment dropdown
        const controlsHTML = `
            <div class="cc-controls" style="position:absolute;top:8px;right:12px;z-index:10;display:flex;gap:6px;align-items:center;">
                <select id="cc-segment-select" style="font-size:11px;padding:3px 6px;border:1px solid #ddd;border-radius:4px;background:#fff;color:#333;cursor:pointer;">
                    <option value="all">All Segments</option>
                    <option value="VIP">🏅 VIP</option>
                    <option value="Regular">👤 Regular</option>
                    <option value="Low Value">📉 Low Value</option>
                    <option value="At Risk">⚠️ At Risk</option>
                </select>
                <button class="metric-btn active" data-metric="monetary" style="font-size:11px;padding:3px 8px;border:1px solid #ddd;border-radius:4px;background:#667eea;color:#fff;cursor:pointer;white-space:nowrap;">Avg Spend</button>
                <button class="metric-btn" data-metric="frequency" style="font-size:11px;padding:3px 8px;border:1px solid #ddd;border-radius:4px;background:#fff;color:#333;cursor:pointer;white-space:nowrap;">Avg Freq</button>
            </div>`;
        container.style.position = 'relative';
        container.insertAdjacentHTML('beforeend', controlsHTML);

        // Metric toggle buttons
        container.querySelectorAll('.metric-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                container.querySelectorAll('.metric-btn').forEach(b => {
                    b.classList.remove('active');
                    b.style.background = '#fff';
                    b.style.color = '#333';
                });
                e.target.classList.add('active');
                e.target.style.background = '#667eea';
                e.target.style.color = '#fff';
                metricMode = e.target.dataset.metric;
                update(currentFilters);
            });
        });

        // Segment dropdown → local control only, does NOT affect global filters
        const segSelect = container.querySelector('#cc-segment-select');
        segSelect.addEventListener('change', (e) => {
            e.stopPropagation();
            selectedSegment = e.target.value;
            update(currentFilters);
        });

        // Click on bar → drill into country (global filter)
        chart.on('click', (params) => {
            if (params.componentType === 'series' && params.name) {
                const country = params.name;
                document.querySelectorAll('#filter-countries .country-cb').forEach(cb => {
                    cb.checked = (cb.value === country);
                });
                const applyBtn = document.getElementById('btn-apply');
                if (applyBtn) applyBtn.click();
            }
        });

        await update({});
    }

    async function update(filters) {
        currentFilters = filters;

        let displayData;
        let segmentLabel;

        if (selectedSegment === 'all') {
            // All segments → use precomputed overall country stats
            const rawStats = DataProcessor.getCountryCustomerStats(filters);
            displayData = rawStats
                .map(d => ({
                    Country: d.Country,
                    value: metricMode === 'monetary' ? d.avg_monetary : d.avg_frequency,
                    _customers: d.total_customers,
                    _sales: d.total_sales,
                    _vip: d.VIP_count,
                    _regular: d.Regular_count,
                    _low: d.LowValue_count,
                    _atRisk: d.AtRisk_count
                }))
                .sort((a, b) => b.value - a.value);
            segmentLabel = null;
        } else {
            // Specific segment → compute per-segment per-country stats from RFM
            const segStats = DataProcessor.getCountrySegmentStats(filters, selectedSegment);
            displayData = segStats
                .map(d => ({
                    Country: d.Country,
                    value: metricMode === 'monetary' ? d.avg_monetary : d.avg_frequency,
                    _count: d.count
                }))
                .sort((a, b) => b.value - a.value);
            segmentLabel = selectedSegment;
        }

        const topN = 15;
        const topData = displayData.slice(0, topN);
        const countries = topData.map(d => d.Country);

        const barColor = segmentLabel
            ? SEGMENT_COLORS[segmentLabel]
            : (new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                { offset: 0, color: '#4facfe' },
                { offset: 1, color: '#667eea' }
            ]));

        const option = {
            title: {
                text: 'Country Customer Profile',
                subtext: segmentLabel
                    ? `Segment: ${segmentLabel} · Top ${topN} by ` + (metricMode === 'monetary' ? 'Avg Spend' : 'Avg Frequency')
                    : 'All Segments · Top ' + topN + ' by ' + (metricMode === 'monetary' ? 'Avg Spend' : 'Avg Frequency'),
                left: 'center',
                top: 4,
                textStyle: { fontSize: 15, fontWeight: 600 },
                subtextStyle: { fontSize: 11, color: '#888' }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: params => {
                    const p = params[0];
                    const unit = metricMode === 'monetary' ? '£' : ' orders';
                    let html = `<b>${p.name}</b><br/>
                        ${p.marker} ${metricMode === 'monetary' ? 'Avg Spend' : 'Avg Frequency'}: <b>${Number(p.value).toFixed(1)}${unit}</b><br/>`;
                    if (p.data._customers !== undefined) {
                        html += `&nbsp;&nbsp;Customers: ${p.data._customers}<br/>`;
                        html += `&nbsp;&nbsp;VIP: ${p.data._vip} | Regular: ${p.data._regular} | Low: ${p.data._low} | At Risk: ${p.data._atRisk}`;
                    } else if (p.data._count !== undefined) {
                        html += `&nbsp;&nbsp;${segmentLabel} customers: ${p.data._count}`;
                    }
                    return html;
                }
            },
            legend: { show: false },
            grid: {
                left: '20%',
                right: '8%',
                top: '18%',
                bottom: '8%'
            },
            xAxis: {
                type: 'value',
                name: metricMode === 'monetary' ? 'Average Spend (£)' : 'Average Frequency (orders)',
                nameLocation: 'center',
                nameGap: 30,
                axisLabel: {
                    fontSize: 10,
                    formatter: v => metricMode === 'monetary'
                        ? (v >= 1000 ? '£' + (v / 1000).toFixed(0) + 'k' : '£' + v.toFixed(0))
                        : v.toFixed(1)
                }
            },
            yAxis: {
                type: 'category',
                data: countries,
                inverse: true,
                axisLabel: { fontSize: 11 }
            },
            series: [{
                name: segmentLabel || 'All',
                type: 'bar',
                data: topData.map(d => ({
                    value: d.value,
                    _customers: d._customers,
                    _sales: d._sales,
                    _vip: d._vip,
                    _regular: d._regular,
                    _low: d._low,
                    _atRisk: d._atRisk,
                    _count: d._count
                })),
                itemStyle: {
                    color: barColor,
                    borderRadius: [0, 4, 4, 0]
                }
            }]
        };

        chart.setOption(option, true);
    }

    return { init, update };
})();
