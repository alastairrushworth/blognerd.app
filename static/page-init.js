// Page Initialization - Run after all modules are loaded

// Initialize the page
initializePage();

// Initialize zoom functionality
if (canvas) {
    addZoomEventListeners();
    updateZoom();

    // Load default DAG if canvas is empty
    if (rssNodes.size === 0) {
        loadDefaultDAG();
    }
}

// Load default example DAG
function loadDefaultDAG() {
    // Create nodes with specific positions (from user's config)
    // Input 1: Data Science with R
    const dsInput = createNode('search-source', 61, 122);
    dsInput.inputs.query = 'data science with R';
    dsInput.inputs.since = 'week';
    const dsInputElement = document.getElementById(dsInput.id);
    const dsQueryInput = dsInputElement.querySelector('[data-field="query"]');
    const dsSinceSelect = dsInputElement.querySelector('[data-field="since"]');
    if (dsQueryInput) dsQueryInput.value = 'data science with R';
    if (dsSinceSelect) dsSinceSelect.value = 'week';

    // Input 2: Statistics with R
    const statInput = createNode('search-source', 64, 349);
    statInput.inputs.query = 'statistics with R';
    statInput.inputs.since = 'week';
    const statInputElement = document.getElementById(statInput.id);
    const statQueryInput = statInputElement.querySelector('[data-field="query"]');
    const statSinceSelect = statInputElement.querySelector('[data-field="since"]');
    if (statQueryInput) statQueryInput.value = 'statistics with R';
    if (statSinceSelect) statSinceSelect.value = 'week';

    // Limit 1: 3 items (for data science path)
    const dsLimit = createNode('limit', 345, 146);
    dsLimit.inputs.count = '3';
    const dsLimitElement = document.getElementById(dsLimit.id);
    const dsCountInput = dsLimitElement.querySelector('[data-field="count"]');
    if (dsCountInput) dsCountInput.value = '3';

    // Limit 2: 2 items (for statistics path)
    const statLimit = createNode('limit', 349, 372);
    statLimit.inputs.count = '2';
    const statLimitElement = document.getElementById(statLimit.id);
    const statCountInput = statLimitElement.querySelector('[data-field="count"]');
    if (statCountInput) statCountInput.value = '2';

    // Output: RSS
    const output = createNode('output', 668, 276);

    // Create connections
    // Data science path: Input -> Limit -> Output
    rssConnections.push({ from: dsInput.id, to: dsLimit.id, id: 'conn-ds-limit' });
    dsInput.connections.outputs.push('conn-ds-limit');
    dsLimit.connections.inputs.push('conn-ds-limit');

    rssConnections.push({ from: dsLimit.id, to: output.id, id: 'conn-ds-limit-output' });
    dsLimit.connections.outputs.push('conn-ds-limit-output');
    output.connections.inputs.push('conn-ds-limit-output');

    // Statistics path: Input -> Limit -> Output
    rssConnections.push({ from: statInput.id, to: statLimit.id, id: 'conn-stat-limit' });
    statInput.connections.outputs.push('conn-stat-limit');
    statLimit.connections.inputs.push('conn-stat-limit');

    rssConnections.push({ from: statLimit.id, to: output.id, id: 'conn-stat-limit-output' });
    statLimit.connections.outputs.push('conn-stat-limit-output');
    output.connections.inputs.push('conn-stat-limit-output');

    // Update connections and preview
    setTimeout(() => {
        updateConnections();
        refreshPreview();
    }, 100);
}
