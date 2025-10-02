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
    // Input 1: Data Science
    const dsInput = createNode('search-source', 82, 169);
    dsInput.inputs.query = 'data science';
    dsInput.inputs.since = 'week';
    const dsInputElement = document.getElementById(dsInput.id);
    const dsQueryInput = dsInputElement.querySelector('[data-field="query"]');
    const dsSinceSelect = dsInputElement.querySelector('[data-field="since"]');
    if (dsQueryInput) dsQueryInput.value = 'data science';
    if (dsSinceSelect) dsSinceSelect.value = 'week';

    // Input 2: Large Language Models
    const llmInput = createNode('search-source', 80, 402);
    llmInput.inputs.query = 'large language models';
    llmInput.inputs.since = 'week';
    const llmInputElement = document.getElementById(llmInput.id);
    const llmQueryInput = llmInputElement.querySelector('[data-field="query"]');
    const llmSinceSelect = llmInputElement.querySelector('[data-field="since"]');
    if (llmQueryInput) llmQueryInput.value = 'large language models';
    if (llmSinceSelect) llmSinceSelect.value = 'week';

    // Filter: Python keyword (only for data science path)
    const pythonFilter = createNode('content-filter', 354, 100);
    pythonFilter.inputs.pattern = 'python';
    pythonFilter.inputs.type = 'keyword';
    pythonFilter.inputs.field = 'title';
    pythonFilter.inputs.mode = 'exclude';
    const filterElement = document.getElementById(pythonFilter.id);
    const patternInput = filterElement.querySelector('[data-field="pattern"]');
    const modeSelect = filterElement.querySelector('[data-field="mode"]');
    if (patternInput) patternInput.value = 'python';
    if (modeSelect) modeSelect.value = 'exclude';

    // Limit 1: 2 items (for data science path)
    const dsLimit = createNode('limit', 638, 169);
    dsLimit.inputs.count = '2';
    const dsLimitElement = document.getElementById(dsLimit.id);
    const dsCountInput = dsLimitElement.querySelector('[data-field="count"]');
    if (dsCountInput) dsCountInput.value = '2';

    // Limit 2: 2 items (for LLM path)
    const llmLimit = createNode('limit', 389, 402);
    llmLimit.inputs.count = '2';
    const llmLimitElement = document.getElementById(llmLimit.id);
    const llmCountInput = llmLimitElement.querySelector('[data-field="count"]');
    if (llmCountInput) llmCountInput.value = '2';

    // Output: RSS
    const output = createNode('output', 969, 299);
    output.inputs.title = 'Tech News Feed';
    output.inputs.description = 'Custom feed combining data science and LLM content';
    const outputElement = document.getElementById(output.id);
    const titleInput = outputElement.querySelector('[data-field="title"]');
    const descInput = outputElement.querySelector('[data-field="description"]');
    if (titleInput) titleInput.value = 'Tech News Feed';
    if (descInput) descInput.value = 'Custom feed combining data science and LLM content';

    // Create connections
    // Data science path: Input -> Filter -> Limit -> Output
    rssConnections.push({ from: dsInput.id, to: pythonFilter.id, id: 'conn-ds-filter' });
    dsInput.connections.outputs.push('conn-ds-filter');
    pythonFilter.connections.inputs.push('conn-ds-filter');

    rssConnections.push({ from: pythonFilter.id, to: dsLimit.id, id: 'conn-filter-limit' });
    pythonFilter.connections.outputs.push('conn-filter-limit');
    dsLimit.connections.inputs.push('conn-filter-limit');

    rssConnections.push({ from: dsLimit.id, to: output.id, id: 'conn-ds-limit-output' });
    dsLimit.connections.outputs.push('conn-ds-limit-output');
    output.connections.inputs.push('conn-ds-limit-output');

    // LLM path: Input -> Limit -> Output
    rssConnections.push({ from: llmInput.id, to: llmLimit.id, id: 'conn-llm-limit' });
    llmInput.connections.outputs.push('conn-llm-limit');
    llmLimit.connections.inputs.push('conn-llm-limit');

    rssConnections.push({ from: llmLimit.id, to: output.id, id: 'conn-llm-limit-output' });
    llmLimit.connections.outputs.push('conn-llm-limit-output');
    output.connections.inputs.push('conn-llm-limit-output');

    // Update connections and preview
    setTimeout(() => {
        updateConnections();
        refreshPreview();
    }, 100);
}
