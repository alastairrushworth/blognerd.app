// Filter and Export Functionality

function updateFilterVisibility(skipTimeDefault = false) {
    const exportGroup = document.getElementById('export-buttons-group');
    const togglePostsGroup = document.getElementById('toggle-posts-group');
    const contentGroup = document.getElementById('content-filter-group');
    const timeGroup = document.getElementById('time-filter-group');
    const sortGroup = document.getElementById('sort-filter-group');
    const timeFilter = document.getElementById('time-filter');

    // Update custom RSS builder visibility
    updateCustomRSSVisibility();

    if (currentSearchType === 'custom') {
        // Custom RSS: hide all filters and search controls
        if (togglePostsGroup) togglePostsGroup.style.display = 'none';
        if (exportGroup) exportGroup.style.display = 'none';
        if (contentGroup) contentGroup.style.display = 'none';
        if (timeGroup) timeGroup.style.display = 'none';
        if (sortGroup) sortGroup.style.display = 'none';
    } else if (currentSearchType === 'sites') {
        // RSS Feeds: show toggle posts and export buttons, hide content, time and sort filters
        if (togglePostsGroup) togglePostsGroup.style.display = 'flex';
        if (exportGroup) exportGroup.style.display = 'flex';
        if (contentGroup) contentGroup.style.display = 'none';
        if (timeGroup) timeGroup.style.display = 'none';
        if (sortGroup) sortGroup.style.display = 'none';
    } else {
        // Posts: hide toggle posts and export buttons, show content, time and sort filters
        if (togglePostsGroup) togglePostsGroup.style.display = 'none';
        if (exportGroup) exportGroup.style.display = 'none';
        if (contentGroup) contentGroup.style.display = 'flex';
        if (timeGroup) timeGroup.style.display = 'flex';
        if (sortGroup) sortGroup.style.display = 'flex';
    }
}

function togglePosts() {
    showPosts = !showPosts;
    const toggleBtn = document.getElementById('toggle-posts-btn');

    if (showPosts) {
        toggleBtn.textContent = '📄 Show Feeds';
        toggleBtn.style.backgroundColor = '#1a73e8';
        toggleBtn.style.color = 'white';
    } else {
        toggleBtn.textContent = '📄 Show Latest Posts';
        toggleBtn.style.backgroundColor = '#f1f3f4';
        toggleBtn.style.color = '#5f6368';
    }

    // Re-run search with new toggle state
    const query = searchInput?.value?.trim();
    if (query) {
        performSearch();
    }
}

function toggleSort() {
    const checkbox = document.getElementById('sort-time-checkbox');
    sortByTime = checkbox.checked;

    // Re-run search with new sort order
    const query = searchInput?.value?.trim();
    if (query) {
        performSearch();
    }
}

function exportOPML() {
    const query = (searchInput?.value || initialSearch?.value || '').trim();
    if (!query) {
        alert('Please perform a feed search first');
        return;
    }

    const params = new URLSearchParams({
        qry: query,
        type: currentSearchType,
        content: document.getElementById('content-filter')?.value || '',
        time: document.getElementById('time-filter')?.value || ''
    });

    // Create a temporary link to trigger download
    const link = document.createElement('a');
    link.href = '/api/export/opml?' + params.toString();
    link.download = 'feeds.opml';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function exportCSV() {
    const query = (searchInput?.value || initialSearch?.value || '').trim();
    if (!query) {
        alert('Please perform a feed search first');
        return;
    }

    const params = new URLSearchParams({
        qry: query,
        type: currentSearchType,
        content: document.getElementById('content-filter')?.value || '',
        time: document.getElementById('time-filter')?.value || ''
    });

    // Create a temporary link to trigger download
    const link = document.createElement('a');
    link.href = '/api/export/csv?' + params.toString();
    link.download = 'feeds.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
