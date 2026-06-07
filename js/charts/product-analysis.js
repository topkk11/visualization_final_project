const ProductAnalysisModule = (() => {
    let chart;
    let currentFilters = {};
    let sortBy = 'sales';

    async function init() {
        chart = echarts.init(document.getElementById('chart-product-analysis'));
        await update({});
    }

    async function update(filters) {
        currentFilters = filters;
        const data = await DataProcessor.getTopProducts(filters, 15, sortBy);

        const names = data.map(d => d.Description);
        const values = data.map(d => d[sortBy]);

        const option = {
            title: { text: 'Top 15 Products', left: 'center', textStyle: { fontSize: 15 } },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'shadow' },
                formatter: params => {
                    const p = params[0];
                    const val = sortBy === 'sales'
                        ? '£' + p.value.toLocaleString()
                        : p.value.toLocaleString();
                    return `${p.name}<br/>${val}`;
                }
            },
            grid: { left: '5%', right: '8%', top: '12%', bottom: '3%', containLabel: true },
            xAxis: {
                type: 'value',
                axisLabel: {
                    formatter: v => sortBy === 'sales' ? '£' + (v / 1000).toFixed(0) + 'k' : v
                }
            },
            yAxis: {
                type: 'category', data: names, inverse: true,
                axisLabel: {
                    width: 200,
                    overflow: 'truncate',
                    ellipsis: '…',
                    fontSize: 10
                }
            },
            series: [{
                type: 'bar', data: values,
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
                        { offset: 0, color: '#4facfe' },
                        { offset: 1, color: '#00f2fe' }
                    ]),
                    borderRadius: [0, 4, 4, 0]
                }
            }]
        };
        chart.setOption(option, true);
    }

    return { init, update };
})();
