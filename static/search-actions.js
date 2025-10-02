// Search Action Functions

function cleanURL(url) {
    // Remove http:// and https:// schemes
    url = url.replace(/^https?:\/\//, '');
    // Remove www. prefix
    url = url.replace(/^www\./, '');
    // Remove trailing slash
    url = url.replace(/\/$/, '');
    return url;
}

function searchMoreLike(url) {
    const newQuery = 'like:' + url;
    if (searchInput) searchInput.value = newQuery;
    if (initialSearch) initialSearch.value = newQuery;

    // This function is now only for similar posts, so always switch to pages
    currentSearchType = 'pages';
    document.querySelectorAll('.type-tab, .type-tab-large').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === 'pages');
    });

    // Update filter visibility
    updateFilterVisibility();

    if (initialState && initialState.style.display !== 'none') {
        switchToSearchState(newQuery);
    }

    performSearch();
}

function searchSimilarBlogs(domain) {
    // Clean the domain to remove https:// etc for blog similarity
    const cleanDomain = cleanURL(domain);
    const newQuery = 'like:' + cleanDomain;
    if (searchInput) searchInput.value = newQuery;
    if (initialSearch) initialSearch.value = newQuery;

    // Switch to sites/feeds to show similar blogs
    currentSearchType = 'sites';
    document.querySelectorAll('.type-tab, .type-tab-large').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === 'sites');
    });

    // Update filter visibility
    updateFilterVisibility();

    if (initialState && initialState.style.display !== 'none') {
        switchToSearchState(newQuery);
    }

    performSearch();
}

function searchFromSite(domain) {
    // Use the original domain exactly as stored in database for accurate site: matching
    const newQuery = 'site:' + domain;
    if (searchInput) searchInput.value = newQuery;
    if (initialSearch) initialSearch.value = newQuery;

    // Always switch to posts/content to show posts from this site
    currentSearchType = 'pages';
    document.querySelectorAll('.type-tab, .type-tab-large').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === 'pages');
    });

    // Reset time filter to "Any time" and content filter to "All" first
    const timeFilter = document.getElementById('time-filter');
    const contentFilter = document.getElementById('content-filter');
    if (timeFilter) timeFilter.value = '';
    if (contentFilter) contentFilter.value = '';

    // Update filter visibility to show posts toolbar, skipping the time default
    updateFilterVisibility(true);

    if (initialState && initialState.style.display !== 'none') {
        switchToSearchState(newQuery);
    }

    performSearch();
}
