const GeoSalesModule = (() => {
    let chart;
    let countryNameMap = {};
    let allGeoCountries = [];
    let selectedGeoName = null;

    async function init() {
        const resp = await fetch('data/world.json');
        const geoJson = await resp.json();
        echarts.registerMap('world', geoJson);

        allGeoCountries = geoJson.features.map(f => f.properties.name);
        countryNameMap = DataProcessor.getCountryNameMap();
        chart = echarts.init(document.getElementById('chart-geo-sales'));

        // Click on a country → highlight + filter other charts (map stays full)
        chart.on('click', (params) => {
            if (params.name) {
                selectedGeoName = params.name;
                chart.dispatchAction({ type: 'highlight', name: params.name });
                const country = Object.entries(countryNameMap)
                    .find(([, v]) => v === params.name)?.[0] || params.name;
                EventBus.emit('countryClick', country);
            }
        });

        // Click on empty map area → clear + reset
        chart.getZr().on('click', (e) => {
            if (!e.target) {
                selectedGeoName = null;
                chart.dispatchAction({ type: 'downplay' });
                EventBus.emit('countryReset');
            }
        });

        EventBus.on('countryReset', () => {
            selectedGeoName = null;
        });

        await update({});
    }

    async function update(filters) {
        // Map ALWAYS shows full dataset — ignore country filter
        const rawData = DataProcessor.getSalesByCountry({
            segmentFilter: filters.segmentFilter
        });
        const isSegmentActive = filters.segmentFilter && filters.segmentFilter.length > 0
            && filters.segmentFilter.length < 4;

        // Build map data for ALL countries
        const dataMap = new Map();
        for (const d of rawData) {
            const geoName = countryNameMap[d.Country];
            if (geoName) {
                const val = isSegmentActive ? (d.segmentCustomerCount || 0) : d.sales;
                dataMap.set(geoName, (dataMap.get(geoName) || 0) + val);
            }
        }
        const mapData = allGeoCountries.map(name => ({
            name,
            value: dataMap.get(name) || 0
        }));
        const maxVal = Math.max(...mapData.map(d => d.value), 1);

        const colors = isSegmentActive
            ? ['#fff5f0', '#fcbba1', '#fb6a4a', '#cb181d']
            : ['#e0f3f8', '#ffffbf', '#fdae61', '#d73027'];

        if (selectedGeoName && !allGeoCountries.includes(selectedGeoName)) {
            selectedGeoName = null;
        }

        // Build piecewise visualMap pieces: value 0 → white, >0 → heatmap gradient
        const q1 = Math.ceil(maxVal * 0.25);
        const q2 = Math.ceil(maxVal * 0.5);
        const q3 = Math.ceil(maxVal * 0.75);

        const option = {
            title: {
                text: isSegmentActive ? 'Customer Segment Distribution' : 'Sales by Country',
                subtext: isSegmentActive
                    ? 'Showing: ' + filters.segmentFilter.join(', ')
                    : '',
                left: 'center',
                textStyle: { fontSize: 15, fontWeight: 600 },
                subtextStyle: { fontSize: 11, color: '#888' }
            },
            visualMap: {
                type: 'piecewise',
                left: 16,
                bottom: '5%',
                pieces: [
                    { gt: q3, lte: maxVal, color: colors[3] },
                    { gt: q2, lte: q3, color: colors[2] },
                    { gt: q1, lte: q2, color: colors[1] },
                    { gt: 0, lte: q1, color: colors[0] },
                ],
                text: isSegmentActive ? ['Many', 'Few'] : ['High', 'Low'],
                calculable: false
            },
            tooltip: {
                trigger: 'item',
                formatter: p => {
                    if (isSegmentActive) {
                        return `${p.name}<br/>Target Customers: <b>${p.value || 0}</b>`;
                    }
                    const v = p.value || 0;
                    return `${p.name}<br/>Sales: <b>£${v ? v.toLocaleString('en-US', {maximumFractionDigits:0}) : '0'}</b>`;
                }
            },
            series: [{
                type: 'map',
                map: 'world',
                roam: true,
                zoom: 1.4,
                center: [10, 52],
                data: mapData,
                // White base for all countries; visualMap pieces only color values > 0
                itemStyle: {
                    areaColor: '#ffffff',
                    borderColor: '#999',
                    borderWidth: 0.5
                },
                emphasis: {
                    label: { show: true, fontSize: 12 },
                    itemStyle: { areaColor: '#ffd700' }
                }
            }]
        };

        chart.setOption(option, true);

        // Restore highlight after setOption
        if (selectedGeoName) {
            chart.dispatchAction({ type: 'highlight', name: selectedGeoName });
        }
    }

    return { init, update };
})();
