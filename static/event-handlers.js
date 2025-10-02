// Event Handlers and Initialization

// Handle initial search
if (initialSearch) {
    initialSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = this.value.trim();
            if (query) {
                switchToSearchState(query);
                performSearch();
            }
        }
    });
}

// Handle search state search
if (searchInput) {
    searchInput.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        if (this.value.trim() === '') return;

        searchTimeout = setTimeout(() => {
            performSearch();
        }, 500);
    });

    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            performSearch();
        }
    });
}

// Handle type tab clicks (both initial and search state)
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('type-tab') || e.target.classList.contains('type-tab-large')) {
        const type = e.target.dataset.type;

        // If custom RSS tab, navigate to /custom-rss
        if (type === 'custom') {
            // Store current search state in sessionStorage before navigating
            const query = (searchInput?.value || initialSearch?.value || '').trim();
            const contentFilter = document.getElementById('content-filter')?.value || '';
            const timeFilter = document.getElementById('time-filter')?.value || '';
            const currentType = currentSearchType;

            if (query) {
                sessionStorage.setItem('lastSearchState', JSON.stringify({
                    query: query,
                    type: currentType,
                    content: contentFilter,
                    time: timeFilter
                }));
            }

            window.location.href = '/custom-rss';
            return;
        }

        // If we're on /custom-rss and clicking non-custom tab, restore last search or go to fresh search
        if (window.location.pathname === '/custom-rss') {
            const lastSearch = sessionStorage.getItem('lastSearchState');

            if (lastSearch) {
                const state = JSON.parse(lastSearch);
                // Clear the stored state
                sessionStorage.removeItem('lastSearchState');
                // Navigate with the stored state, but update type to clicked tab
                window.location.href = `/?qry=${encodeURIComponent(state.query)}&type=${type}&content=${state.content}&time=${state.time}`;
            } else {
                window.location.href = `/?type=${type}`;
            }
            return;
        }

        currentSearchType = type;

        // Update active state
        const container = e.target.parentElement;
        container.querySelectorAll('.type-tab, .type-tab-large').forEach(tab => {
            tab.classList.remove('active');
        });
        e.target.classList.add('active');

        // Update filter visibility based on search type
        updateFilterVisibility();
        updateCustomRSSVisibility();

        // If we have a search query, perform search
        const query = (searchInput?.value || initialSearch?.value || '').trim();
        if (query) {
            if (initialState && initialState.style.display !== 'none') {
                switchToSearchState(query);
            }
            performSearch();
        }
    }
});

// Handle filter changes
document.addEventListener('change', function(e) {
    if (e.target.classList.contains('filter-select')) {
        const query = searchInput?.value?.trim();
        if (query) {
            performSearch();
        }
    }
});

// Handle browser back/forward buttons
window.addEventListener('popstate', function(event) {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('qry') || '';
    const type = urlParams.get('type') || 'pages';
    const content = urlParams.get('content') || '';
    const time = urlParams.get('time') || '';
    const sort = urlParams.get('sort');

    // Update current search type
    currentSearchType = type;

    // Update sort state
    sortByTime = (sort === 'time');
    const sortCheckbox = document.getElementById('sort-time-checkbox');
    if (sortCheckbox) {
        sortCheckbox.checked = sortByTime;
    }

    // Update UI state based on URL parameters
    if (query) {
        // Switch to search state if we have a query
        if (initialState && initialState.style.display !== 'none') {
            switchToSearchState(query);
        }

        // Update search input
        if (searchInput) searchInput.value = query;

        // Update type tabs
        document.querySelectorAll('.type-tab, .type-tab-large').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === type);
        });

        // Update filter dropdowns
        const contentFilter = document.getElementById('content-filter');
        const timeFilter = document.getElementById('time-filter');
        if (contentFilter) contentFilter.value = content;
        if (timeFilter) timeFilter.value = time;

        // Update filter visibility
        updateFilterVisibility();

        // Perform search with current parameters
        performSearch();
    } else {
        // No query, still show search state (no landing page anymore)
        if (initialState) initialState.style.display = 'none';
        if (searchState) searchState.style.display = 'block';
        if (initialSearch) initialSearch.value = '';

        // Update type tabs for search state
        document.querySelectorAll('.type-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === type);
        });
    }
});

// Clear all settings on page refresh (but stay in search view)
function clearAllSettingsOnRefresh() {
    // Clear URL parameters
    const url = new URL(window.location);
    url.search = '';
    window.history.replaceState({}, '', url);

    // Clear search inputs
    if (searchInput) searchInput.value = '';
    if (initialSearch) initialSearch.value = '';

    // Reset filters to defaults
    const timeFilter = document.getElementById('time-filter');
    const contentFilter = document.getElementById('content-filter');
    if (timeFilter) {
        timeFilter.value = '';
        timeFilter.selectedIndex = 0;
    }
    if (contentFilter) {
        contentFilter.value = '';
        contentFilter.selectedIndex = 0;
    }

    // Reset search type to posts
    currentSearchType = 'pages';
    document.querySelectorAll('.type-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === 'pages');
    });
    document.querySelectorAll('.type-tab-large').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === 'pages');
    });

    // Clear results
    if (resultsDiv) resultsDiv.innerHTML = '';

    // Stay in search view (don't go back to landing page)
    if (initialState && searchState) {
        initialState.style.display = 'none';
        searchState.style.display = 'block';
    }
}

// Initialize page based on URL parameters
function initializePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('qry') || '';
    // Check if we're on /custom-rss path, otherwise use URL param or default to 'pages'
    const type = window.location.pathname === '/custom-rss' ? 'custom' : (urlParams.get('type') || 'pages');
    const content = urlParams.get('content') || '';
    const time = urlParams.get('time') || '';
    const sort = urlParams.get('sort');

    // Update current search type
    currentSearchType = type;

    // Update sort state
    sortByTime = (sort === 'time');
    const sortCheckbox = document.getElementById('sort-time-checkbox');
    if (sortCheckbox) {
        sortCheckbox.checked = sortByTime;
    }

    if (query) {
        // We have a query, set up search state
        if (initialState) initialState.style.display = 'none';
        if (searchState) searchState.style.display = 'block';
        if (searchInput) searchInput.value = query;

        // Update type tabs
        document.querySelectorAll('.type-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === type);
        });

        // Update filter dropdowns
        const contentFilter = document.getElementById('content-filter');
        const timeFilter = document.getElementById('time-filter');
        if (contentFilter) contentFilter.value = content;
        if (timeFilter) timeFilter.value = time;

        // Update filter visibility
        updateFilterVisibility();

        // Perform search automatically
        performSearch();
    } else {
        // No query, still show search state (no landing page anymore)
        if (initialState) initialState.style.display = 'none';
        if (searchState) searchState.style.display = 'block';

        // Update type tabs for search state
        document.querySelectorAll('.type-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === type);
        });

        // Check if this is a page refresh (not a navigation) and clear settings
        if (performance.navigation.type === performance.navigation.TYPE_RELOAD ||
            performance.getEntriesByType("navigation")[0].type === "reload") {
            clearAllSettingsOnRefresh();
        }
    }

    // Initialize filter visibility
    updateFilterVisibility();
    updateCustomRSSVisibility();
}
