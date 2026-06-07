const FilterModule = (() => {
    let currentFilters = {
        dateFrom: null,
        dateTo: null,
        countries: null,        // null = no filter (all), [] = empty, [...] = filtered
        productSearch: '',
        segmentFilter: []
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

        // dateFrom changes → clamp dateTo min
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

        // dateTo changes → clamp dateFrom max
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

        // Listen for "reset to all countries" from map empty-click
        EventBus.on('countryReset', () => {
            document.querySelectorAll('#filter-countries .country-cb').forEach(cb => {
                cb.checked = true;
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

        const allCountries = DataProcessor.getCountries();
        const checkedCountries = [...document.querySelectorAll('#filter-countries .country-cb:checked')]
            .map(cb => cb.value);
        // All checked → null (no filter); none checked → [] (empty); partial → [...values]
        if (checkedCountries.length === allCountries.length) {
            currentFilters.countries = null;
        } else if (checkedCountries.length === 0) {
            currentFilters.countries = [];
        } else {
            currentFilters.countries = checkedCountries;
        }

        currentFilters.productSearch = document.getElementById('filter-product').value.trim() || null;
        const allSegments = [...document.querySelectorAll('#filter-segments .segment-cb')].map(cb => cb.value);
        const checkedSegments = [...document.querySelectorAll('#filter-segments .segment-cb:checked')].map(cb => cb.value);
        currentFilters.segmentFilter = (checkedSegments.length === allSegments.length) ? [] : checkedSegments;
        EventBus.emit('filterChange', currentFilters);
    }

    function resetFilters() {
        currentFilters = { dateFrom: null, dateTo: null, countries: null, productSearch: null, segmentFilter: [] };
        document.getElementById('filter-date-from').value = '';
        document.getElementById('filter-date-to').value = '';
        document.getElementById('filter-product').value = '';
        document.querySelectorAll('#filter-countries .country-cb').forEach(cb => { cb.checked = true; });
        document.querySelectorAll('#filter-segments .segment-cb').forEach(cb => { cb.checked = true; });
        EventBus.emit('filterChange', currentFilters);
    }

    return { init, getCurrentFilters };
})();
