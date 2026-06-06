const FilterModule = (() => {
    let currentFilters = {
        dateFrom: null,
        dateTo: null,
        countries: [],
        productSearch: ''
    };

    async function init() {
        const dateRange = DataProcessor.getDateRange();
        const countries = DataProcessor.getCountries();

        const dateFromEl = document.getElementById('filter-date-from');
        const dateToEl = document.getElementById('filter-date-to');

        dateFromEl.min = dateRange.min;
        dateFromEl.max = dateRange.max;
        dateToEl.min = dateRange.min;
        dateToEl.max = dateRange.max;

        // 联动：dateFrom改变 → 限制dateTo的最小值
        dateFromEl.addEventListener('change', () => {
            if (dateFromEl.value) {
                dateToEl.min = dateFromEl.value;
                if (dateToEl.value && dateToEl.value < dateFromEl.value) {
                    dateToEl.value = dateFromEl.value;
                }
            } else {
                dateToEl.min = dateRange.min;
            }
        });

        // 联动：dateTo改变 → 限制dateFrom的最大值
        dateToEl.addEventListener('change', () => {
            if (dateToEl.value) {
                dateFromEl.max = dateToEl.value;
                if (dateFromEl.value && dateFromEl.value > dateToEl.value) {
                    dateFromEl.value = dateToEl.value;
                }
            } else {
                dateFromEl.max = dateRange.max;
            }
        });

        const countryDiv = document.getElementById('filter-countries');
        countryDiv.innerHTML = countries.map(c =>
            `<label><input type="checkbox" value="${c}" class="country-cb" checked> ${c}</label>`
        ).join('');

        document.getElementById('btn-apply').addEventListener('click', applyFilters);
        document.getElementById('btn-reset').addEventListener('click', resetFilters);
        document.getElementById('filter-product').addEventListener('keydown', e => {
            if (e.key === 'Enter') applyFilters();
        });

        EventBus.on('countryClick', (country) => {
            document.querySelectorAll('#filter-countries .country-cb').forEach(cb => {
                cb.checked = (cb.value === country);
            });
            applyFilters();
        });
    }

    function getCurrentFilters() {
        return { ...currentFilters };
    }

    function applyFilters() {
        currentFilters.dateFrom = document.getElementById('filter-date-from').value || null;
        currentFilters.dateTo = document.getElementById('filter-date-to').value || null;
        currentFilters.countries = [...document.querySelectorAll('#filter-countries .country-cb:checked')]
            .map(cb => cb.value);
        currentFilters.productSearch = document.getElementById('filter-product').value.trim() || null;
        EventBus.emit('filterChange', currentFilters);
    }

    function resetFilters() {
        currentFilters = { dateFrom: null, dateTo: null, countries: [], productSearch: null };
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        document.getElementById('filter-product').value = '';
        document.querySelectorAll('#filter-countries .country-cb').forEach(cb => { cb.checked = true; });
        EventBus.emit('filterChange', currentFilters);
    }

    return { init, getCurrentFilters };
})();
