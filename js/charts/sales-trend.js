const SalesTrendModule = (() => {
    let chart;
    let currentFilters = {};
    let granularity = 'month';
    let xAxisDates = [];        // current xAxis date labels
    let programmaticUpdate = false;

    // Convert a granular date string to YYYY-MM-DD for the filter inputs
    function toDateInput(granDate) {
        if (!granDate) return '';
        // Week format: "2009-11-30/2009-12-06" → take start date before "/"
        if (granDate.includes('/')) {
            return granDate.split('/')[0];
        }
        if (/^\d{4}-\d{2}-\d{2}$/.test(granDate)) {
            return granDate;  // Day level, already YYYY-MM-DD
        }
        if (/^\d{4}-\d{2}$/.test(granDate)) {
            return granDate + '-01';  // Month level → first day
        }
        return '';
    }

    async function init() {
        chart = echarts.init(document.getElementById('chart-sales-trend'));

        // dataZoom → update filter date inputs (sync on every drag)
        chart.on('datazoom', (params) => {
            if (programmaticUpdate) return;

            // Read zoom range from event (works for both slider and inside zoom)
            let startPct = params.start;
            let endPct = params.end;
            // Fallback: batch array (when multiple dataZoom components exist)
            if ((startPct === undefined || startPct === null) && params.batch && params.batch.length > 0) {
                startPct = params.batch[0].start;
                endPct = params.batch[0].end;
            }
            if (startPct === undefined) startPct = 0;
            if (endPct === undefined) endPct = 100;

            const n = xAxisDates.length;
            if (n === 0) return;

            const startIdx = Math.max(0, Math.round((startPct / 100) * (n - 1)));
            const endIdx = Math.min(n - 1, Math.round((endPct / 100) * (n - 1)));

            const dateFrom = toDateInput(xAxisDates[startIdx]);
            const dateTo = toDateInput(xAxisDates[endIdx]);

            // Only reflect chart state back to filter inputs (no auto-apply)
            const dateFromEl = document.getElementById('filter-date-from');
            const dateToEl = document.getElementById('filter-date-to');
            if (dateFromEl) dateFromEl.value = dateFrom;
            if (dateToEl) dateToEl.value = dateTo;
        });

        document.querySelectorAll('.granularity-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.querySelectorAll('.granularity-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                granularity = e.target.dataset.gran;
                await update(currentFilters);
            });
        });

        await update({});

        // Initialize filter date inputs to full data range
        if (xAxisDates.length > 0) {
            const dateFromEl = document.getElementById('filter-date-from');
            const dateToEl = document.getElementById('filter-date-to');
            if (dateFromEl && !dateFromEl.value) {
                dateFromEl.value = toDateInput(xAxisDates[0]);
            }
            if (dateToEl && !dateToEl.value) {
                dateToEl.value = toDateInput(xAxisDates[xAxisDates.length - 1]);
            }
        }
    }

    // Extract a comparable date string from granular date (e.g., "2009-11-30/2009-12-06" → "2009-11-30")
    function normDate(d) {
        if (!d) return '';
        return d.includes('/') ? d.split('/')[0] : d;
    }

    async function update(filters) {
        currentFilters = filters;
        const data = await DataProcessor.getSalesByTime(filters, granularity);
        xAxisDates = data.map(d => d.DateStr || d.YearWeek || d.YearMonth);

        // If filters have date range, compute dataZoom percentages to reflect them
        let zoomStart = 0, zoomEnd = 100;
        if (filters.dateFrom && filters.dateTo && xAxisDates.length > 0) {
            // Normalize filter dates to match the granularity of xAxis dates
            // e.g., if xAxis uses "2010-06" (month), truncate filter "2010-06-15" → "2010-06"
            const sampleXDate = normDate(xAxisDates[0]);
            const matchLen = sampleXDate.length;  // 7 for month, 10 for day/week
            const dateFrom = filters.dateFrom.substring(0, matchLen);
            const dateTo = filters.dateTo.substring(0, matchLen);

            const fromIdx = xAxisDates.findIndex(d => normDate(d) >= dateFrom);
            let toIdx = -1;
            for (let i = xAxisDates.length - 1; i >= 0; i--) {
                if (normDate(xAxisDates[i]) <= dateTo) {
                    toIdx = i;
                    break;
                }
            }
            if (fromIdx >= 0 && toIdx >= 0 && fromIdx <= toIdx) {
                const n = xAxisDates.length;
                zoomStart = Math.max(0, Math.floor((fromIdx / (n - 1)) * 100));
                zoomEnd = Math.min(100, Math.ceil((toIdx / (n - 1)) * 100));
            }
        }

        programmaticUpdate = true;
        const option = {
            title: { text: 'Sales Trend', left: 'center', textStyle: { fontSize: 15 } },
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross', crossStyle: { color: '#999' } }
            },
            legend: { data: ['Sales (£)', 'Orders'], top: 28, left: 'center' },
            grid: { left: '8%', right: '8%', top: '18%', bottom: '12%' },
            dataZoom: [
                { type: 'slider', start: zoomStart, end: zoomEnd, height: 20, bottom: 18 },
                { type: 'inside', start: zoomStart, end: zoomEnd }
            ],
            xAxis: {
                type: 'category',
                data: xAxisDates,
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
        programmaticUpdate = false;
    }

    return { init, update };
})();
