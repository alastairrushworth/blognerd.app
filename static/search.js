// Search Functionality

function switchToSearchState(query) {
    if (initialState) initialState.style.display = 'none';
    if (searchState) searchState.style.display = 'block';
    if (searchInput) searchInput.value = query;

    // Update search state type tabs
    document.querySelectorAll('#search-state .type-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.type === currentSearchType);
    });

    // Update filter visibility
    updateFilterVisibility();
}

function performSearch() {
    const query = (searchInput?.value || initialSearch?.value || '').trim();
    if (!query) return;

    if (loadingDiv) loadingDiv.style.display = 'block';
    if (resultsDiv) resultsDiv.innerHTML = '';

    const params = new URLSearchParams({
        qry: query,
        type: currentSearchType,
        content: document.getElementById('content-filter')?.value || '',
        time: document.getElementById('time-filter')?.value || ''
    });

    // Add include_posts parameter for RSS feeds when toggle is enabled
    if (currentSearchType === 'sites' && showPosts) {
        params.set('include_posts', 'true');
    }

    // Add sort parameter for posts
    if (currentSearchType === 'pages' && sortByTime) {
        params.set('sort', 'time');
    }

    fetch('/api/search?' + params.toString())
        .then(response => response.json())
        .then(data => {
            if (loadingDiv) loadingDiv.style.display = 'none';
            displayResults(data);
            updateURL(params);
        })
        .catch(error => {
            if (loadingDiv) loadingDiv.style.display = 'none';
            console.error('Search error:', error);
            if (resultsDiv) resultsDiv.innerHTML = '<div class="no-results">Search failed. Please try again.</div>';
        });
}

function displayResults(data) {
    if (!resultsDiv) return;

    if (data.results && data.results.length > 0) {
        // Check if we should hide RSS link for feeds search
        const hideRss = currentSearchType === 'sites';
        const headerClass = hideRss ? 'results-header hide-rss' : 'results-header';

        let html = '<div class="' + headerClass + '">' +
                  '<div class="results-stats">About ' +
                  data.total_results + ' results (' + data.time_taken.toFixed(2) + ' seconds)</div>' +
                  '<a href="#" id="rss-feed-link" class="rss-feed-link" onclick="openRSSFeed()" title="Subscribe to RSS feed for this search">' +
                  '<svg class="rss-icon" viewBox="0 0 24 24">' +
                  '<path d="M6.503 20.752c0 1.794-1.456 3.248-3.251 3.248S0 22.546 0 20.752s1.456-3.248 3.252-3.248 3.251 1.454 3.251 3.248zM1.677 6.155v4.301c7.017 0 12.696 5.679 12.696 12.696h4.301c0-9.404-7.593-17-17-17zM1.677.003v4.301C12.083 4.304 20.321 12.54 20.321 23h4.301C24.622 11.228 13.395.003 1.677.003z"/>' +
                  '</svg>RSS</a></div>';

        data.results.forEach(result => {
            // If this is a feed search with posts toggled, show posts instead of feeds
            if (result.is_feed_search && showPosts && result.latest_post_title) {
                // Display as a post result
                const postDateStr = result.latest_post_date ? ` • ${result.latest_post_date}` : '';
                html += `<div class="result-item page-result">
                    <div class="result-url">${result.basedomain}${postDateStr}</div>
                    <div class="result-title">
                        <a href="${result.latest_post_url}" target="_blank">${result.latest_post_title}</a>
                    </div>
                    <div class="result-snippet">${result.latest_post_snippet || ''}</div>
                    <div class="result-meta"></div>
                    <div class="result-actions">
                        <a class="action-link" onclick="searchMoreLike('${result.latest_post_url}')">Similar posts</a>
                        <a class="action-link" onclick="searchSimilarBlogs('${result.original_domain}')">Similar blogs</a>
                        <a class="action-link" onclick="searchFromSite('${result.original_domain}')">More from site</a>
                    </div>
                </div>`;
            } else if (result.is_feed_search && showPosts && !result.latest_post_title) {
                // Skip feeds that don't have latest posts when in posts mode
                return;
            } else {
                // Normal display (feeds or regular posts)
                const siteClass = result.is_feed_search ? 'site-result' : 'page-result';
                const dateStr = (!result.is_feed_search && result.date) ? ` • ${result.date}` : '';
                html += `<div class="result-item ${siteClass}">
                    <div class="result-url">${result.basedomain}${dateStr}</div>
                    <div class="result-title"><a href="${result.url}" target="_blank">${result.title}</a></div>
                    <div class="result-snippet">${result.subtitle}</div>
                    <div class="result-meta"></div>
                    <div class="result-actions">`;

                if (!result.is_feed_search) {
                    html += `<a class="action-link" onclick="searchMoreLike('${result.url}')">Similar posts</a>`;
                    html += `<a class="action-link" onclick="searchSimilarBlogs('${result.original_domain}')">Similar blogs</a>`;
                } else {
                    html += `<a class="action-link" onclick="searchSimilarBlogs('${result.original_domain}')">Similar blogs</a>`;
                }
                html += `<a class="action-link" onclick="searchFromSite('${result.original_domain}')">More from site</a>`;

                if (result.is_feed_search && result.rss_url) {
                    html += `<a href="${result.rss_url}" class="rss-link" target="_blank">📡 RSS Feed</a>`;
                }
                html += `</div></div>`;
            }
        });

        resultsDiv.innerHTML = html;
    } else {
        const query = searchInput?.value || initialSearch?.value || '';
        resultsDiv.innerHTML = `<div class="no-results">
            <p>No results found for "<strong>${query}</strong>"</p>
            <p>Try different keywords or check your spelling.</p>
        </div>`;
    }
}

function updateURL(params) {
    // Always use root path for searches (not custom RSS)
    const newURL = '/?' + params.toString();
    history.pushState(null, '', newURL);
}

function openRSSFeed() {
    const query = (searchInput?.value || initialSearch?.value || '').trim();
    if (!query) {
        alert('Please perform a search first');
        return false;
    }

    const params = new URLSearchParams({
        qry: query,
        type: currentSearchType,
        content: document.getElementById('content-filter')?.value || '',
        time: document.getElementById('time-filter')?.value || ''
    });

    // Add include_posts parameter for RSS feeds when toggle is enabled
    if (currentSearchType === 'sites' && showPosts) {
        params.set('include_posts', 'true');
    }

    // Add sort parameter for posts
    if (currentSearchType === 'pages' && sortByTime) {
        params.set('sort', 'time');
    }

    const rssURL = '/rss?' + params.toString();
    window.open(rssURL, '_blank');
    return false;
}
