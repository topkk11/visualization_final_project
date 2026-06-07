const RFMScatterModule = (() => {
    let chart;
    let currentFilters = {};

    const SEGMENT_COLORS = {
        'VIP':        '#e74c3c',
        'Regular':    '#3498db',
        'Low Value':  '#95a5a6',
        'At Risk':    '#f39c12'
    };
    const SEGMENTS = ['VIP', 'Regular', 'Low Value', 'At Risk'];

    async function init() {
        chart = echarts.init(document.getElementById('chart-rfm-scatter'));

        // Click on a segment → filter to that segment
        chart.on('click', (params) => {
            if (params.name && SEGMENTS.includes(params.name)) {
                document.querySelectorAll('#filter-segments .segment-cb').forEach(cb => {
                    cb.checked = (cb.value === params.name);
                });
                const applyBtn = document.getElementById('btn-apply');
                if (applyBtn) applyBtn.click();
            }
        });

        await update({});
    }

    async function update(filters) {
        currentFilters = filters;
        const segData = DataProcessor.getSegmentDistribution(filters);
        const totalCustomers = segData.reduce((s, d) => s + d.value, 0);

        const option = {
            title: {
                text: 'Customer Value Analysis',
                subtext: totalCustomers > 0
                    ? totalCustomers.toLocaleString() + ' customers'
                    : 'No data for this selection',
                left: 'center',
                textStyle: { fontSize: 15, fontWeight: 600 },
                subtextStyle: { fontSize: 11, color: '#888' }
            },
            tooltip: {
                trigger: 'item',
                formatter: p => `${p.name}: <b>${p.value.toLocaleString()}</b> customers (${p.percent}%)`
            },
            legend: {
                data: SEGMENTS,
                bottom: 6,
                left: 'center',
                textStyle: { fontSize: 11 }
            },
            graphic: totalCustomers === 0 ? [{
                type: 'text',
                left: 'center',
                top: '42%',
                style: { text: 'No customers', fill: '#999', fontSize: 14, textAlign: 'center' }
            }] : [],
            series: [{
                type: 'pie',
                radius: ['40%', '68%'],
                center: ['50%', '48%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 4,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: {
                    show: totalCustomers > 0,
                    position: 'outside',
                    formatter: p => `${p.name}\n${p.value.toLocaleString()} (${p.percent}%)`,
                    fontSize: 11
                },
                emphasis: {
                    label: { fontSize: 14, fontWeight: 'bold' },
                    scaleSize: 10
                },
                data: totalCustomers > 0
                    ? segData.map(d => ({
                        name: d.name,
                        value: d.value,
                        itemStyle: { color: SEGMENT_COLORS[d.name] }
                    }))
                    : [{ name: 'No data', value: 1, itemStyle: { color: '#e8e8e8' } }],
                silent: totalCustomers === 0
            }]
        };

        chart.setOption(option, true);
    }

    return { init, update };
})();
