// Page initialization and browser navigation handling

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
        // No query, show initial state
        if (initialState) initialState.style.display = 'block';
        if (searchState) searchState.style.display = 'none';
        if (initialSearch) initialSearch.value = '';
        
        // Update type tabs for initial state
        document.querySelectorAll('.type-tab-large').forEach(tab => {
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
        timeFilter.selectedIndex = 0; // Explicitly select first option
    }
    if (contentFilter) {
        contentFilter.value = '';
        contentFilter.selectedIndex = 0; // Explicitly select first option ("All")
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
    const query = urlParams.get('qry') || '{{.Query}}';
    const type = urlParams.get('type') || '{{.SearchType}}' || 'pages';
    const content = urlParams.get('content') || '{{.SearchContent}}';
    const time = urlParams.get('time') || '{{.SearchTime}}';
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
        // No query, show initial state
        if (initialState) initialState.style.display = 'block';
        if (searchState) searchState.style.display = 'none';
        
        // Update type tabs for initial state
        document.querySelectorAll('.type-tab-large').forEach(tab => {
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
    
    // Initialize event handlers
    initializeSearchHandlers();
    initializeTabHandlers();
    initializeFilterHandlers();
}

// Initialize everything when page loads
function initializeAll() {
    // Initialize the page
    initializePage();
    
    // Initialize zoom functionality for canvas
    const canvas = document.getElementById('rss-canvas');
    if (canvas) {
        addZoomEventListeners();
        updateZoom();
    }
}