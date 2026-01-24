// Email Digest JavaScript

// State
let currentUser = null;
let digests = [];
let currentDigest = null;
let editingSourceIndex = null;
let editingRuleIndex = null;
let sourcePreviewTimeout = null;
let combinedCache = {}; // Cache for combined preview: digestId -> {results, bySource}
let cachedRawResults = []; // For rules filtering

// Timezone list
const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'America/Mexico_City',
    'America/Sao_Paulo',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Moscow',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Asia/Hong_Kong',
    'Asia/Shanghai',
    'Australia/Sydney',
    'Pacific/Auckland'
];

// Initialize email digest feature
function initEmailDigest() {
    // TEMPORARY: Skip auth for testing
    currentUser = { id: 'test-user', email: 'test@example.com', name: 'Test User' };
    showAuthenticatedView();
    loadDigests();
    // Populate timezone selector
    populateTimezones();
}

// Populate timezone selector
function populateTimezones() {
    const select = document.getElementById('digest-timezone');
    if (!select) return;

    // Get browser's timezone
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // Clear existing options
    select.innerHTML = '';

    // Add timezones
    timezones.forEach(tz => {
        const option = document.createElement('option');
        option.value = tz;
        option.textContent = tz.replace(/_/g, ' ');
        if (tz === browserTz) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    // If browser timezone not in list, add it and select it
    if (!timezones.includes(browserTz)) {
        const option = document.createElement('option');
        option.value = browserTz;
        option.textContent = browserTz.replace(/_/g, ' ');
        option.selected = true;
        select.insertBefore(option, select.firstChild);
    }
}

// Auth functions
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'include'
        });

        if (response.ok) {
            currentUser = await response.json();
            showAuthenticatedView();
            loadDigests();
        } else {
            showSignInView();
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        showSignInView();
    }
}

function showSignInView() {
    document.getElementById('digest-signin-required').style.display = 'block';
    document.getElementById('digest-authenticated').style.display = 'none';
}

function showAuthenticatedView() {
    document.getElementById('digest-signin-required').style.display = 'none';
    document.getElementById('digest-authenticated').style.display = 'block';
    document.getElementById('user-email-display').textContent = currentUser.email;
}

// Modal functions
function showSignInModal() {
    document.getElementById('signin-modal').style.display = 'flex';
    document.getElementById('signin-email').focus();
}

function closeSignInModal() {
    document.getElementById('signin-modal').style.display = 'none';
    document.getElementById('signin-form').reset();
    document.getElementById('signin-error').style.display = 'none';
}

async function handleSignIn(event) {
    event.preventDefault();

    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            closeSignInModal();
            showAuthenticatedView();
            loadDigests();
        } else {
            document.getElementById('signin-error').textContent = 'Sign in failed. Please try again.';
            document.getElementById('signin-error').style.display = 'block';
        }
    } catch (error) {
        console.error('Sign in error:', error);
        document.getElementById('signin-error').textContent = 'An error occurred. Please try again.';
        document.getElementById('signin-error').style.display = 'block';
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
        currentUser = null;
        digests = [];
        showSignInView();
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Digest management
async function loadDigests() {
    document.getElementById('digest-loading').style.display = 'block';
    document.getElementById('digest-items').innerHTML = '';
    document.getElementById('digest-empty').style.display = 'none';

    try {
        const response = await fetch('/api/email-digests', {
            credentials: 'include'
        });

        if (response.ok) {
            digests = await response.json();
            document.getElementById('digest-loading').style.display = 'none';

            if (digests.length === 0) {
                document.getElementById('digest-empty').style.display = 'block';
            } else {
                renderDigests();
            }
        } else {
            console.error('Failed to load digests');
            document.getElementById('digest-loading').style.display = 'none';
        }
    } catch (error) {
        console.error('Load digests error:', error);
        document.getElementById('digest-loading').style.display = 'none';
    }
}

function renderDigests() {
    const container = document.getElementById('digest-items');
    container.innerHTML = '';

    digests.forEach(digest => {
        const card = document.createElement('div');
        card.className = 'digest-card';

        const statusClass = digest.active ? 'active' : 'inactive';
        const statusText = digest.active ? 'Active' : 'Paused';

        const sourcesPreview = digest.sources.slice(0, 3).map(s =>
            `<span class="topic-tag">${s.name}</span>`
        ).join('');

        const moreSources = digest.sources.length > 3 ?
            `<span class="topic-tag">+${digest.sources.length - 3} more</span>` : '';

        card.innerHTML = `
            <div class="digest-card-header">
                <h3 class="digest-card-title">${digest.name}</h3>
                <div class="digest-card-actions">
                    <button class="btn-icon" onclick="editDigest('${digest.id}')" title="Edit">✏️</button>
                    <button class="btn-icon" onclick="deleteDigestConfirm('${digest.id}')" title="Delete">🗑️</button>
                </div>
            </div>
            <div class="digest-card-meta">
                <span><span class="digest-status ${statusClass}">${statusText}</span></span>
                <span>📅 ${digest.frequency}</span>
                <span>🕐 ${digest.preferences.delivery_time} ${digest.preferences.timezone}</span>
                <span>📊 ${digest.sources.length} source${digest.sources.length !== 1 ? 's' : ''}</span>
            </div>
            <div class="digest-topics-preview">
                ${sourcesPreview}
                ${moreSources}
            </div>
        `;

        container.appendChild(card);
    });
}

function showCreateDigestForm() {
    currentDigest = {
        name: '',
        frequency: 'daily',
        sources: [],
        rules: [],
        preferences: {
            delivery_time: '08:00',
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            include_images: false
        },
        active: true,
        ai_description: '' // Store AI description
    };

    document.getElementById('form-title').textContent = 'Create Email Digest';

    // Show AI section, hide main fields
    document.getElementById('ai-description-section').style.display = 'block';
    document.getElementById('digest-main-fields').style.display = 'none';
    document.getElementById('regenerate-section').style.display = 'none';
    document.getElementById('digest-description').value = '';

    // Clear main form
    document.getElementById('digest-name').value = '';
    document.getElementById('digest-frequency').value = 'daily';
    document.getElementById('digest-delivery-time').value = '08:00';
    document.getElementById('digest-active').checked = true;
    document.getElementById('sources-list').innerHTML = '<div class="empty">No sources added yet</div>';
    document.getElementById('rules-list').innerHTML = '<div class="empty">No rules added yet</div>';

    // Set timezone
    populateTimezones();
    const tzSelect = document.getElementById('digest-timezone');
    tzSelect.value = currentDigest.preferences.timezone;

    // Clear cache for new digest
    delete combinedCache.new;

    // Hide digest list and empty state when form is open
    document.getElementById('digest-list').style.display = 'none';

    document.getElementById('digest-form-container').style.display = 'block';
    document.getElementById('digest-description').focus();
}

async function editDigest(digestId) {
    const digest = digests.find(d => d.id === digestId);
    if (!digest) return;

    currentDigest = { ...digest, rules: digest.rules || [] };

    document.getElementById('form-title').textContent = 'Edit Email Digest';

    // For editing, skip AI section and show main fields directly
    document.getElementById('ai-description-section').style.display = 'none';
    document.getElementById('digest-main-fields').style.display = 'block';
    document.getElementById('regenerate-section').style.display = 'none';

    document.getElementById('digest-name').value = digest.name;
    document.getElementById('digest-frequency').value = digest.frequency;
    document.getElementById('digest-delivery-time').value = digest.preferences.delivery_time;
    document.getElementById('digest-active').checked = digest.active;

    // Set timezone
    populateTimezones();
    const tzSelect = document.getElementById('digest-timezone');
    tzSelect.value = digest.preferences.timezone;

    renderSourcesList();
    renderRulesList();

    // Hide digest list when form is open
    document.getElementById('digest-list').style.display = 'none';

    document.getElementById('digest-form-container').style.display = 'block';
    document.getElementById('digest-name').focus();
}

function hideDigestForm() {
    document.getElementById('digest-form-container').style.display = 'none';
    // Show digest list again
    document.getElementById('digest-list').style.display = 'block';
    currentDigest = null;
    editingSourceIndex = null;
}

async function saveDigest() {
    const name = document.getElementById('digest-name').value.trim();
    if (!name) {
        alert('Please enter a digest name');
        return;
    }

    if (currentDigest.sources.length === 0) {
        alert('Please add at least one source');
        return;
    }

    const digestData = {
        id: currentDigest.id,
        name: name,
        frequency: document.getElementById('digest-frequency').value,
        sources: currentDigest.sources,
        rules: currentDigest.rules || [],
        preferences: {
            delivery_time: document.getElementById('digest-delivery-time').value,
            timezone: document.getElementById('digest-timezone').value,
            include_images: false
        },
        active: document.getElementById('digest-active').checked
    };

    // Clear cache when saving (sources may have changed)
    if (currentDigest.id) {
        delete combinedCache[currentDigest.id];
    }

    const saveBtn = document.getElementById('save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
        const isEdit = currentDigest.id;
        const url = isEdit ? `/api/email-digests/${currentDigest.id}` : '/api/email-digests';
        const method = isEdit ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(digestData)
        });

        if (response.ok) {
            hideDigestForm();
            await loadDigests();
        } else {
            alert('Failed to save digest');
        }
    } catch (error) {
        console.error('Save digest error:', error);
        alert('An error occurred while saving');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Digest';
    }
}

async function deleteDigestConfirm(digestId) {
    if (!confirm('Are you sure you want to delete this digest?')) {
        return;
    }

    try {
        const response = await fetch(`/api/email-digests/${digestId}`, {
            method: 'DELETE',
            credentials: 'include'
        });

        if (response.ok) {
            await loadDigests();
        } else {
            alert('Failed to delete digest');
        }
    } catch (error) {
        console.error('Delete digest error:', error);
        alert('An error occurred while deleting');
    }
}

// Source management
function showAddSourceModal() {
    editingSourceIndex = null;
    document.getElementById('source-modal-title').textContent = 'Add Source';
    document.getElementById('source-query').value = '';
    document.getElementById('source-modal').style.display = 'flex';
    document.getElementById('source-preview-loading').style.display = 'none';
    document.getElementById('source-preview-results').style.display = 'none';
    document.getElementById('source-preview-results').innerHTML = '';

    // Setup auto-preview
    const queryInput = document.getElementById('source-query');
    queryInput.focus();

    // Remove existing listener if any
    queryInput.removeEventListener('input', handleSourceQueryInput);
    queryInput.addEventListener('input', handleSourceQueryInput);
}

function editSource(index) {
    editingSourceIndex = index;
    const source = currentDigest.sources[index];

    document.getElementById('source-modal-title').textContent = 'Edit Source';
    document.getElementById('source-query').value = source.query;
    document.getElementById('source-modal').style.display = 'flex';

    // Setup auto-preview
    const queryInput = document.getElementById('source-query');
    queryInput.focus();

    // Remove existing listener if any
    queryInput.removeEventListener('input', handleSourceQueryInput);
    queryInput.addEventListener('input', handleSourceQueryInput);

    // Trigger initial preview
    autoPreviewSource();
}

function closeSourceModal() {
    document.getElementById('source-modal').style.display = 'none';
    editingSourceIndex = null;

    // Clear timeout
    if (sourcePreviewTimeout) {
        clearTimeout(sourcePreviewTimeout);
        sourcePreviewTimeout = null;
    }

    // Remove listener
    const queryInput = document.getElementById('source-query');
    queryInput.removeEventListener('input', handleSourceQueryInput);
}

function handleSourceQueryInput() {
    // Clear existing timeout
    if (sourcePreviewTimeout) {
        clearTimeout(sourcePreviewTimeout);
    }

    // Set new timeout for auto-preview (500ms debounce)
    sourcePreviewTimeout = setTimeout(() => {
        autoPreviewSource();
    }, 500);
}

function saveSource() {
    const query = document.getElementById('source-query').value.trim();

    if (!query) {
        alert('Please enter a search query');
        return;
    }

    const source = {
        id: editingSourceIndex !== null ? currentDigest.sources[editingSourceIndex].id : generateId(),
        name: query, // Use query as name
        query: query,
        max_results: 10 // Default to 10
    };

    if (editingSourceIndex !== null) {
        currentDigest.sources[editingSourceIndex] = source;
    } else {
        currentDigest.sources.push(source);
    }

    // Invalidate cache when sources change
    const digestId = currentDigest.id || 'new';
    delete combinedCache[digestId];

    renderSourcesList();
    closeSourceModal();
}

function deleteSource(index) {
    if (!confirm('Remove this source?')) {
        return;
    }
    currentDigest.sources.splice(index, 1);

    // Invalidate cache when sources change
    const digestId = currentDigest.id || 'new';
    delete combinedCache[digestId];

    renderSourcesList();
}

function renderSourcesList() {
    const container = document.getElementById('sources-list');

    if (currentDigest.sources.length === 0) {
        container.innerHTML = '<div class="empty">No sources added yet</div>';
        container.classList.add('empty');
        return;
    }

    container.classList.remove('empty');
    container.innerHTML = '';

    currentDigest.sources.forEach((source, index) => {
        const sourceEl = document.createElement('div');
        sourceEl.className = 'source-item';
        sourceEl.innerHTML = `
            <div class="source-info">
                <div class="source-name">${source.name}</div>
            </div>
            <div class="source-actions">
                <button class="btn-icon" onclick="quickPreviewSource(${index})" title="Preview">👁️</button>
                <button class="btn-icon" onclick="editSource(${index})" title="Edit">✏️</button>
                <button class="btn-icon" onclick="deleteSource(${index})" title="Remove">🗑️</button>
            </div>
        `;
        container.appendChild(sourceEl);
    });
}

// Source preview (auto-triggered)
async function autoPreviewSource() {
    const query = document.getElementById('source-query').value.trim();

    // Clear preview if query is empty
    if (!query) {
        document.getElementById('source-preview-loading').style.display = 'none';
        document.getElementById('source-preview-results').style.display = 'none';
        return;
    }

    const source = {
        id: generateId(),
        name: query,
        query: query,
        max_results: 10
    };

    const frequency = document.getElementById('digest-frequency').value;

    document.getElementById('source-preview-loading').style.display = 'block';
    document.getElementById('source-preview-results').style.display = 'none';

    try {
        const response = await fetch('/api/email-digests/preview-source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ source, frequency })
        });

        if (response.ok) {
            const preview = await response.json();
            renderSourcePreview(preview);
        } else {
            document.getElementById('source-preview-loading').style.display = 'none';
            document.getElementById('source-preview-results').style.display = 'none';
        }
    } catch (error) {
        console.error('Preview error:', error);
        document.getElementById('source-preview-loading').style.display = 'none';
        document.getElementById('source-preview-results').style.display = 'none';
    }
}

function renderSourcePreview(preview) {
    document.getElementById('source-preview-loading').style.display = 'none';

    const resultsContainer = document.getElementById('source-preview-results');
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = '';

    if (preview.results.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No results found for this query.</p>';
        return;
    }

    preview.results.forEach(result => {
        const resultEl = document.createElement('div');
        resultEl.className = 'source-preview-result';
        resultEl.innerHTML = `
            <div class="source-preview-result-url">${result.basedomain} ${result.date ? '• ' + result.date : ''}</div>
            <a href="${result.url}" target="_blank" class="source-preview-result-title">${result.title}</a>
            <div class="source-preview-result-snippet">${result.subtitle}</div>
        `;
        resultsContainer.appendChild(resultEl);
    });
}

// Quick preview functions
async function quickPreviewSource(index) {
    const source = currentDigest.sources[index];
    const frequency = document.getElementById('digest-frequency').value;

    document.getElementById('quick-preview-title').textContent = `Preview: ${source.name}`;
    document.getElementById('quick-preview-modal').style.display = 'flex';
    document.getElementById('quick-preview-loading').style.display = 'block';
    document.getElementById('quick-preview-results').style.display = 'none';

    try {
        const response = await fetch('/api/email-digests/preview-source', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ source, frequency })
        });

        if (response.ok) {
            const preview = await response.json();
            renderQuickPreview(preview);
        } else {
            closeQuickPreviewModal();
            alert('Failed to load preview');
        }
    } catch (error) {
        console.error('Quick preview error:', error);
        closeQuickPreviewModal();
        alert('An error occurred while loading preview');
    }
}

function renderQuickPreview(preview) {
    document.getElementById('quick-preview-loading').style.display = 'none';

    const resultsContainer = document.getElementById('quick-preview-results');
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = '';

    if (preview.results.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No results found.</p>';
        return;
    }

    preview.results.forEach(result => {
        const resultEl = document.createElement('div');
        resultEl.className = 'source-preview-result';
        resultEl.innerHTML = `
            <div class="source-preview-result-url">${result.basedomain} ${result.date ? '• ' + result.date : ''}</div>
            <a href="${result.url}" target="_blank" class="source-preview-result-title">${result.title}</a>
            <div class="source-preview-result-snippet">${result.subtitle}</div>
        `;
        resultsContainer.appendChild(resultEl);
    });
}

function closeQuickPreviewModal() {
    document.getElementById('quick-preview-modal').style.display = 'none';
}

// Rules management
function renderRulesList() {
    const container = document.getElementById('rules-list');

    if (!currentDigest.rules || currentDigest.rules.length === 0) {
        container.innerHTML = '<div class="empty">No rules added yet</div>';
        container.classList.add('empty');
        return;
    }

    container.classList.remove('empty');
    container.innerHTML = '';

    currentDigest.rules.forEach((rule, index) => {
        const ruleEl = document.createElement('div');
        ruleEl.className = 'rule-item';

        let typeLabel = rule.type;
        if (rule.type === 'site_exclude') {
            typeLabel = 'Site Exclude';
        } else if (rule.type === 'keyword_exclude') {
            typeLabel = 'Keyword Exclude';
        }

        ruleEl.innerHTML = `
            <div class="rule-info">
                <div class="rule-type">${typeLabel}</div>
                <div class="rule-value">${rule.value}</div>
            </div>
            <div class="rule-actions">
                <button class="btn-icon" onclick="deleteRule(${index})" title="Remove">🗑️</button>
            </div>
        `;
        container.appendChild(ruleEl);
    });
}

async function showAddRuleModal() {
    if (!currentDigest.sources || currentDigest.sources.length === 0) {
        alert('Please add at least one source before adding rules');
        return;
    }

    editingRuleIndex = null;
    document.getElementById('rules-modal-title').textContent = 'Add Rule';
    document.getElementById('rule-type').value = 'site_exclude';
    document.getElementById('rule-value').value = '';
    document.getElementById('rules-modal').style.display = 'flex';

    // Load combined preview and cache it
    await loadCombinedPreview();
}

function closeRulesModal() {
    document.getElementById('rules-modal').style.display = 'none';
    editingRuleIndex = null;
}

function saveRule() {
    const type = document.getElementById('rule-type').value;
    const value = document.getElementById('rule-value').value.trim();

    if (!value) {
        alert('Please enter a domain or URL');
        return;
    }

    const rule = {
        id: editingRuleIndex !== null ? currentDigest.rules[editingRuleIndex].id : generateId(),
        type: type,
        value: value
    };

    if (editingRuleIndex !== null) {
        currentDigest.rules[editingRuleIndex] = rule;
    } else {
        currentDigest.rules.push(rule);
    }

    renderRulesList();
    closeRulesModal();
}

function deleteRule(index) {
    if (!confirm('Remove this rule?')) {
        return;
    }
    currentDigest.rules.splice(index, 1);
    renderRulesList();
}

function handleRuleTypeChange() {
    const type = document.getElementById('rule-type').value;
    const label = document.getElementById('rule-value-label');
    const input = document.getElementById('rule-value');
    const helpText = document.getElementById('rule-help-text');

    if (type === 'site_exclude') {
        label.textContent = 'Domain or URL';
        input.placeholder = 'e.g., example.com or example.com/path';
        helpText.textContent = 'Content from this domain/URL will be excluded from your digest';
    } else if (type === 'keyword_exclude') {
        label.textContent = 'Keyword or Phrase';
        input.placeholder = 'e.g., cryptocurrency, sponsored, advertisement';
        helpText.textContent = 'Content containing this keyword in title or description will be excluded';
    }
}

// Combined preview and caching
async function loadCombinedPreview() {
    const digestId = currentDigest.id || 'new';

    // Check cache first
    if (combinedCache[digestId]) {
        cachedRawResults = combinedCache[digestId].results;
        applyRulesAndDisplay();
        return;
    }

    // Show loading
    document.getElementById('rules-preview-container').style.display = 'block';
    document.getElementById('rules-preview-loading').style.display = 'block';
    document.getElementById('rules-preview-results').style.display = 'none';

    try {
        // For new digests, build preview from current state
        if (!currentDigest.id) {
            const preview = await fetchCombinedForDraft();
            combinedCache.new = preview;
            cachedRawResults = preview.results;
        } else {
            // For existing digests, use API
            const response = await fetch(`/api/email-digests/${currentDigest.id}/combined-preview`, {
                credentials: 'include'
            });

            if (response.ok) {
                const preview = await response.json();
                combinedCache[digestId] = preview;
                cachedRawResults = preview.results;
            } else {
                throw new Error('Failed to fetch combined preview');
            }
        }

        applyRulesAndDisplay();
    } catch (error) {
        console.error('Load combined preview error:', error);
        document.getElementById('rules-preview-loading').style.display = 'none';
        alert('Failed to load combined preview');
    }
}

async function fetchCombinedForDraft() {
    // Fetch all sources and combine them
    const allResults = [];
    const seenURLs = new Set();
    const frequency = document.getElementById('digest-frequency').value;

    for (const source of currentDigest.sources) {
        try {
            const response = await fetch('/api/email-digests/preview-source', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ source, frequency })
            });

            if (response.ok) {
                const preview = await response.json();
                preview.results.forEach(result => {
                    if (!seenURLs.has(result.url)) {
                        seenURLs.add(result.url);
                        allResults.push(result);
                    }
                });
            }
        } catch (error) {
            console.error(`Error fetching source ${source.name}:`, error);
        }
    }

    return {
        results: allResults,
        total_items: allResults.length,
        by_source: {}
    };
}

function applyRulesAndDisplay() {
    const beforeCount = cachedRawResults.length;

    // Apply all rules
    let filteredResults = [...cachedRawResults];

    currentDigest.rules.forEach(rule => {
        filteredResults = applyRule(filteredResults, rule);
    });

    const afterCount = filteredResults.length;
    const excludedCount = beforeCount - afterCount;

    // Update stats
    document.getElementById('rules-before-count').textContent = beforeCount;
    document.getElementById('rules-after-count').textContent = afterCount;
    document.getElementById('rules-excluded-count').textContent = excludedCount;

    // Display results
    document.getElementById('rules-preview-loading').style.display = 'none';
    const resultsContainer = document.getElementById('rules-preview-results');
    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = '';

    if (filteredResults.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">No results remaining after filtering.</p>';
        return;
    }

    filteredResults.forEach(result => {
        const resultEl = document.createElement('div');
        resultEl.className = 'source-preview-result';
        resultEl.innerHTML = `
            <div class="source-preview-result-url">${result.basedomain} ${result.date ? '• ' + result.date : ''}</div>
            <a href="${result.url}" target="_blank" class="source-preview-result-title">${result.title}</a>
            <div class="source-preview-result-snippet">${result.subtitle}</div>
        `;
        resultsContainer.appendChild(resultEl);
    });
}

function applyRule(results, rule) {
    if (rule.type === 'site_exclude') {
        const excludeValue = rule.value.toLowerCase();
        return results.filter(result => {
            const url = result.url.toLowerCase();
            const domain = result.basedomain.toLowerCase();
            // Check if URL or domain contains the exclude value
            return !url.includes(excludeValue) && !domain.includes(excludeValue);
        });
    } else if (rule.type === 'keyword_exclude') {
        const excludeKeyword = rule.value.toLowerCase();
        return results.filter(result => {
            const title = (result.title || '').toLowerCase();
            const subtitle = (result.subtitle || '').toLowerCase();
            // Check if title or subtitle contains the keyword
            return !title.includes(excludeKeyword) && !subtitle.includes(excludeKeyword);
        });
    }
    return results;
}

// Utility
function generateId() {
    return 'item-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

function getTimePeriodText(frequency) {
    switch (frequency) {
        case 'daily':
            return 'Content from the last 24 hours';
        case 'weekly':
            return 'Content from the last 7 days';
        case 'monthly':
            return 'Content from the last 30 days';
        default:
            return 'Content from the last 24 hours';
    }
}

// Tab switching
function switchToEmailTab() {
    // Hide search state
    document.getElementById('search-state').style.display = 'none';

    // Show email digest container
    document.getElementById('email-digest-container').style.display = 'block';

    // Initialize if first time
    if (currentUser === null && digests.length === 0) {
        initEmailDigest();
    }
}

function switchFromEmailTab() {
    // Show search state
    document.getElementById('search-state').style.display = 'block';

    // Hide email digest container
    document.getElementById('email-digest-container').style.display = 'none';
}

// AI Generation Functions
async function generateDigestFromAI() {
    const description = document.getElementById('digest-description').value.trim();

    if (!description) {
        alert('Please describe what kind of content you want to receive');
        return;
    }

    const generateBtn = document.getElementById('generate-btn');
    const originalText = generateBtn.textContent;
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    try {
        const response = await fetch('/api/email-digests/generate-from-description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ description })
        });

        if (!response.ok) {
            throw new Error('Failed to generate digest');
        }

        const result = await response.json();

        // Populate the digest with AI results
        currentDigest.name = result.name;
        currentDigest.frequency = result.frequency;
        currentDigest.ai_description = description;

        // Convert AI sources to proper format
        currentDigest.sources = result.sources.map((s, index) => ({
            id: generateId(),
            name: s.query,
            query: s.query,
            max_results: 10
        }));

        // Populate form fields
        document.getElementById('digest-name').value = result.name;
        document.getElementById('digest-frequency').value = result.frequency;
        document.getElementById('digest-description-edit').value = description;

        renderSourcesList();
        renderRulesList();

        // Show main fields and hide AI section
        document.getElementById('ai-description-section').style.display = 'none';
        document.getElementById('digest-main-fields').style.display = 'block';
        document.getElementById('regenerate-section').style.display = 'block';

    } catch (error) {
        console.error('AI generation error:', error);
        alert('Failed to generate digest. Please try again or configure manually.');
    } finally {
        generateBtn.disabled = false;
        generateBtn.textContent = originalText;
    }
}

async function regenerateDigestFromAI() {
    const description = document.getElementById('digest-description-edit').value.trim();

    if (!description) {
        alert('Please enter a description');
        return;
    }

    if (!confirm('This will replace your current sources. Continue?')) {
        return;
    }

    try {
        const response = await fetch('/api/email-digests/generate-from-description', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ description })
        });

        if (!response.ok) {
            throw new Error('Failed to regenerate digest');
        }

        const result = await response.json();

        // Update digest with new AI results
        currentDigest.name = result.name;
        currentDigest.frequency = result.frequency;
        currentDigest.ai_description = description;

        // Replace sources
        currentDigest.sources = result.sources.map((s, index) => ({
            id: generateId(),
            name: s.query,
            query: s.query,
            max_results: 10
        }));

        // Update form fields
        document.getElementById('digest-name').value = result.name;
        document.getElementById('digest-frequency').value = result.frequency;

        // Clear cache since sources changed
        const digestId = currentDigest.id || 'new';
        delete combinedCache[digestId];

        renderSourcesList();

    } catch (error) {
        console.error('AI regeneration error:', error);
        alert('Failed to regenerate digest. Please try again.');
    }
}

function skipAIGeneration() {
    // Show main fields without AI generation
    document.getElementById('ai-description-section').style.display = 'none';
    document.getElementById('digest-main-fields').style.display = 'block';
    document.getElementById('regenerate-section').style.display = 'none';
    document.getElementById('digest-name').focus();
}

// Newsletter Preview Functions
async function previewNewsletter() {
    const name = document.getElementById('digest-name').value.trim();
    if (!name) {
        alert('Please enter a digest name');
        return;
    }

    if (currentDigest.sources.length === 0) {
        alert('Please add at least one source');
        return;
    }

    const previewBtn = document.getElementById('preview-newsletter-btn');
    const originalText = previewBtn.textContent;
    previewBtn.disabled = true;
    previewBtn.textContent = 'Generating...';

    // Show modal and loading
    document.getElementById('newsletter-preview-modal').style.display = 'flex';
    document.getElementById('newsletter-preview-loading').style.display = 'block';
    document.getElementById('newsletter-preview-content').style.display = 'none';

    try {
        const frequency = document.getElementById('digest-frequency').value;

        // Prepare request data
        const requestData = {
            name: name,
            frequency: frequency,
            sources: currentDigest.sources,
            rules: currentDigest.rules || []
        };

        const response = await fetch('/api/email-digests/generate-newsletter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(error || 'Failed to generate newsletter');
        }

        const result = await response.json();

        // Display the HTML newsletter
        document.getElementById('newsletter-preview-loading').style.display = 'none';
        const contentDiv = document.getElementById('newsletter-preview-content');
        contentDiv.innerHTML = result.html;
        contentDiv.style.display = 'block';

    } catch (error) {
        console.error('Newsletter generation error:', error);
        closeNewsletterPreview();
        alert('Failed to generate newsletter preview. Please try again.');
    } finally {
        previewBtn.disabled = false;
        previewBtn.textContent = originalText;
    }
}

function closeNewsletterPreview() {
    document.getElementById('newsletter-preview-modal').style.display = 'none';
    document.getElementById('newsletter-preview-content').innerHTML = '';
}
