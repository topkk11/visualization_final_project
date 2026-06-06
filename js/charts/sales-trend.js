const SalesTrendModule = (() => {
    let chart;
    let currentFilters = {};
    let granularity = 'month';

    async function init() {
        chart = echarts.init(document.getElementById('chart-sales-trend'));

        document.querySelectorAll('.granularity-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.querySelectorAll('.granularity-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                granularity = e.target.dataset.gran;
                await update(currentFilters);
            });
        });

        await update({});
    }

    async function update(filters) {
        currentFilters = filters;
        const data = await DataProcessor.getSalesByTime(filters, granularity);

        const option = {
            title: { text: 'Sales Trend', left: 'center', textStyle: { fontSize: 15 } },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross', crossStyle: { color: '#999' } }
            },
            legend: { data: ['Sales (£)', 'Orders'], top: 28, left: 'center' },
            grid: { left: '8%', right: '8%', top: '18%', bottom: '12%' },
            dataZoom: [
                { type: 'slider', start: 0, end: 100, height: 20, bottom: 18 },
                { type: 'inside' }
            ],
            xAxis: {
                type: 'category',
                data: data.map(d => d.DateStr || d.YearWeek || d.YearMonth),
                axisLabel: { rotate: 45, fontSize: 10 }
            },
            yAxis: [
                {
                    type: 'value', name: 'Sales (£)',
                    axisLabel: { formatter: v => (v / 1000).toFixed(0) + 'k' }
                },
                { type: 'value', name: 'Orders' }
            ],
            series: [
                {
                    name: 'Sales (£)', type: 'line', data: data.map(d => d.sales),
                    smooth: true,
                    areaStyle: { color: 'rgba(102, 126, 234, 0.15)' },
                    lineStyle: { color: '#667eea', width: 2 },
                    itemStyle: { color: '#667eea' }
                },
                {
                    name: 'Orders', type: 'bar', yAxisIndex: 1,
                    data: data.map(d => d.orders),
                    barMaxWidth: 18,
                    itemStyle: { color: 'rgba(240, 147, 251, 0.7)' }
                }
            ]
        };
        chart.setOption(option, true);
    }

    return { init, update };
})();
