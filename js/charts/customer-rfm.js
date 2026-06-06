const CustomerRFMModule = (() => {
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
        chart = echarts.init(document.getElementById('chart-customer-rfm'));
        await update({});
    }

    async function update(filters) {
        currentFilters = filters;
        const data = await DataProcessor.getRFMData();

        // ---- 计算各分群统计 ----
        const stats = {};
        for (const seg of SEGMENTS) {
            const group = data.filter(d => d.segment === seg);
            if (group.length === 0) {
                stats[seg] = { count: 0, avgR: 0, avgF: 0, avgM: 0 };
            } else {
                const n = group.length;
                stats[seg] = {
                    count: n,
                    avgR: Math.round(group.reduce((s, d) => s + d.recency, 0) / n),
                    avgF: +(group.reduce((s, d) => s + d.frequency, 0) / n).toFixed(1),
                    avgM: Math.round(group.reduce((s, d) => s + d.monetary, 0) / n)
                };
            }
        }

        // ---- 归一化 (0-100%) ----
        const allR = SEGMENTS.map(s => stats[s].avgR);
        const allF = SEGMENTS.map(s => stats[s].avgF);
        const allM = SEGMENTS.map(s => stats[s].avgM);
        const maxR = Math.max(...allR, 1);
        const maxF = Math.max(...allF, 1);
        const maxM = Math.max(...allM, 1);

        function pct(val, max) { return +((val / max) * 100).toFixed(1); }

        // ---- 图表1: 环形图 (客户分群人数占比) ----
        const pieData = SEGMENTS.map(seg => ({
            name: seg,
            value: stats[seg].count
        }));

        const pieColors = SEGMENTS.map(s => SEGMENT_COLORS[s]);

        // ---- 图表2: 分组柱状图 (归一化的平均R/F/M) ----
        const metrics = ['Recency', 'Frequency', 'Monetary'];
        const barSeries = metrics.map((metric, i) => {
            const colorPalette = ['#ee6666', '#5470c6', '#3ba272'];
            return {
                name: metric,
                type: 'bar',
                barGap: '10%',
                data: SEGMENTS.map(seg => {
                    const raw = [stats[seg].avgR, stats[seg].avgF, stats[seg].avgM];
                    const maxs = [maxR, maxF, maxM];
                    return { value: pct(raw[i], maxs[i]), _raw: raw[i] };
                }),
                itemStyle: { color: colorPalette[i], borderRadius: [4, 4, 0, 0] },
                label: { show: false }
            };
        });

        const option = {
            title: { text: 'Customer RFM Analysis', left: 'center', top: 8, textStyle: { fontSize: 15 } },
            legend: {
                data: [...SEGMENTS, 'Recency', 'Frequency', 'Monetary'],
                bottom: 6,
                left: 'center',
                textStyle: { fontSize: 11 }
            },
            grid: [
                { left: '4%', top: '18%', width: '43%', bottom: '16%' },
                { left: '53%', top: '18%', width: '43%', bottom: '16%' }
            ],
            xAxis: [
                { gridIndex: 0, show: false },
                { gridIndex: 1, type: 'category', data: SEGMENTS, axisLabel: { fontSize: 11 } }
            ],
            yAxis: [
                { gridIndex: 0, show: false },
                { gridIndex: 1, type: 'value', max: 100, axisLabel: { formatter: v => v + '%', fontSize: 10 } }
            ],
            series: [
                {
                    name: 'Segments',
                    type: 'pie',
                    radius: ['35%', '65%'],
                    center: ['23%', '52%'],
                    data: pieData,
                    color: pieColors,
                    label: {
                        formatter: '{b}\n{d}%',
                        fontSize: 11,
                        lineHeight: 16
                    },
                    emphasis: {
                        label: { fontSize: 14, fontWeight: 'bold' }
                    },
                    tooltip: {
                        formatter: p => `${p.name}: ${p.value} customers (${p.percent}%)`
                    }
                },
                ...barSeries
            ],
            tooltip: [
                {}, // pie 用第一个
                { // bar 公用第二个
                    trigger: 'axis',
                    axisPointer: { type: 'shadow' },
                    formatter: params => {
                        const rawMap = { Recency: 'days', Frequency: 'orders', Monetary: '£' };
                        return params.map(p => {
                            const unit = rawMap[p.seriesName] || '';
                            const val = p.data._raw;
                            return `${p.seriesName}: ${unit === '£' ? '£' : ''}${val}${unit !== '£' ? ' ' + unit : ''}`;
                        }).join('<br/>');
                    }
                }
            ]
        };

        chart.setOption(option, true);
    }

    return { init, update };
})();
