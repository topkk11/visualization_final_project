const GeoSalesModule = (() => {
    let chart;
    let currentFilters = {};

    const COUNTRY_NAME_MAP = {
        'United Kingdom': 'United Kingdom',
        'France': 'France',
        'Germany': 'Germany',
        'Australia': 'Australia',
        'USA': 'United States of America',
        'EIRE': 'Ireland',
        'Spain': 'Spain',
        'Netherlands': 'Netherlands',
        'Belgium': 'Belgium',
        'Switzerland': 'Switzerland',
        'Portugal': 'Portugal',
        'Norway': 'Norway',
        'Italy': 'Italy',
        'Channel Islands': 'United Kingdom',
        'Finland': 'Finland',
        'Cyprus': 'Cyprus',
        'Sweden': 'Sweden',
        'Austria': 'Austria',
        'Denmark': 'Denmark',
        'Poland': 'Poland',
        'Japan': 'Japan',
        'Israel': 'Israel',
        'RSA': 'South Africa',
        'Czech Republic': 'Czech Republic',
        'Canada': 'Canada',
        'Brazil': 'Brazil',
        'Greece': 'Greece',
        'Iceland': 'Iceland',
        'Malta': 'Malta',
        'Saudi Arabia': 'Saudi Arabia',
        'Bahrain': 'Bahrain',
        'Hong Kong': 'China',
        'Singapore': 'Singapore',
        'Lebanon': 'Lebanon',
        'Lithuania': 'Lithuania',
        'United Arab Emirates': 'United Arab Emirates'
    };

    async function init() {
        const resp = await fetch('data/world.json');
        const geoJson = await resp.json();
        echarts.registerMap('world', geoJson);

        chart = echarts.init(document.getElementById('chart-geo-sales'));

        chart.on('click', (params) => {
            if (params.name) {
                const country = Object.entries(COUNTRY_NAME_MAP)
                    .find(([, v]) => v === params.name)?.[0] || params.name;
                EventBus.emit('countryClick', country);
            }
        });

        await update({});
    }

    async function update(filters) {
        currentFilters = filters;
        const rawData = await DataProcessor.getSalesByCountry(filters);

        const mapData = [];
        for (const d of rawData) {
            const geoName = COUNTRY_NAME_MAP[d.Country];
            if (geoName) {
                const existing = mapData.find(m => m.name === geoName);
                if (existing) {
                    existing.value += d.sales;
                } else {
                    mapData.push({ name: geoName, value: d.sales });
                }
            }
        }

        const maxVal = Math.max(...mapData.map(d => d.value), 1);

        const option = {
            title: { text: 'Sales by Country', left: 'center', textStyle: { fontSize: 15 } },
            visualMap: {
                min: 0, max: maxVal,
                left: 16, bottom: '5%',
                text: ['High', 'Low'],
                inRange: { color: ['#e0f3f8', '#ffffbf', '#fdae61', '#d73027'] },
                calculable: true
            },
            tooltip: {
                trigger: 'item',
                formatter: p => `${p.name}<br/>Sales: £${p.value ? p.value.toLocaleString('en-US', { maximumFractionDigits: 0 }) : 'N/A'}`
            },
            series: [{
                type: 'map', map: 'world', roam: true,
                zoom: 1.4, center: [10, 52],
                data: mapData,
                emphasis: {
                    label: { show: true, fontSize: 12 },
                    itemStyle: { areaColor: '#ffd700' }
                }
            }]
        };
        chart.setOption(option, true);
    }

    return { init, update };
})();
