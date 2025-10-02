// Custom RSS Builder - Workflow Processing and Preview

// Check if there's a connected path from any source to the output
function isOutputConnected() {
    // Find the output node
    let outputNode = null;
    rssNodes.forEach(nodeData => {
        if (nodeData.type === 'output') {
            outputNode = nodeData;
        }
    });

    if (!outputNode) return false;

    // Traverse backwards from output to find if any source is connected
    const visited = new Set();
    const queue = [outputNode.id];

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (visited.has(currentId)) continue;
        visited.add(currentId);

        const currentNode = rssNodes.get(currentId);
        if (!currentNode) continue;

        // If we reached a source, the output is connected
        if (currentNode.type === 'search-source') {
            return true;
        }

        // Find all nodes that connect TO this node (inputs)
        rssConnections.forEach(conn => {
            if (conn.to === currentId && !visited.has(conn.from)) {
                queue.push(conn.from);
            }
        });
    }

    return false;
}

// Build workflow from nodes
function buildWorkflow() {
    const sources = [];
    const filters = [];
    const processors = [];
    let output = null;

    rssNodes.forEach(nodeData => {
        if (nodeData.type === 'search-source') {
            sources.push(nodeData);
        } else if (nodeData.type === 'content-filter') {
            filters.push(nodeData);
        } else if (nodeData.type === 'sort' || nodeData.type === 'limit') {
            processors.push(nodeData);
        } else if (nodeData.type === 'output') {
            output = nodeData;
        }
    });

    if (sources.length === 0 || !output) {
        return null;
    }

    // Check if output is actually connected to a source
    if (!isOutputConnected()) {
        return null;
    }

    return { sources, filters, processors, output };
}

// Process workflow with real API calls
async function processWorkflow(workflow) {
    let allProcessedItems = [];

    // Process each source independently by following its path through the graph
    for (const source of workflow.sources) {
        try {
            let items = [];

            if (source.type === 'search-source') {
                const query = source.inputs.query || '';

                if (!query.trim()) {
                    console.warn('Search source has no query configured');
                    continue;
                }

                // Make API call to the search endpoint (always search for pages/posts)
                const params = new URLSearchParams();
                params.set('qry', query);
                // Type is always 'pages' (posts), no need to set it explicitly

                // Add time filter if specified
                if (source.inputs.since) {
                    params.set('time', source.inputs.since);
                }

                const response = await fetch(`/api/search?${params.toString()}`);
                const data = await response.json();

                // Convert search results to RSS item format
                items = data.results ? data.results.slice(0, 10).map((result, index) => ({
                    title: result.title,
                    description: result.description || result.title,
                    link: result.url,
                    pubDate: result.date || new Date().toISOString(),
                    source: `Search: ${query}`,
                    relevanceScore: data.results.length - index  // Higher score = more relevant
                })) : [];
            }

            // Process this source's items through its specific path
            let processedItems = await processPath(source, items, workflow.output);
            allProcessedItems = allProcessedItems.concat(processedItems);

        } catch (error) {
            console.error(`Error processing source ${source.type}:`, error);
        }
    }

    // Sort all items by time descending before returning (for RSS output)
    allProcessedItems.sort((a, b) => {
        const aTime = new Date(a.pubDate);
        const bTime = new Date(b.pubDate);
        return bTime - aTime; // Descending (newest first)
    });

    return allProcessedItems;
}

// Process items through a specific path from source to output
async function processPath(startNode, items, outputNode) {
    let currentItems = items;
    const visited = new Set();
    const queue = [{ node: startNode, items: currentItems }];

    while (queue.length > 0) {
        const { node, items: nodeItems } = queue.shift();

        if (visited.has(node.id)) continue;
        visited.add(node.id);

        currentItems = nodeItems;

        // If we reached the output, return the items
        if (node.id === outputNode.id) {
            return currentItems;
        }

        // Find the next node(s) in this path
        const nextConnections = rssConnections.filter(conn => conn.from === node.id);

        for (const conn of nextConnections) {
            const nextNode = rssNodes.get(conn.to);
            if (!nextNode) continue;

            let processedItems = currentItems;

            // Apply transformations based on node type
            if (nextNode.type === 'content-filter') {
                const pattern = nextNode.inputs.pattern || '';
                const mode = nextNode.inputs.mode || 'include';
                const field = nextNode.inputs.field || 'title';

                if (pattern.trim()) {
                    const lowerPattern = pattern.toLowerCase();
                    processedItems = processedItems.filter(item => {
                        const text = (item[field] || '').toLowerCase();
                        const matches = text.includes(lowerPattern);
                        return mode === 'include' ? matches : !matches;
                    });
                }
            } else if (nextNode.type === 'sort') {
                const field = nextNode.inputs.field || 'relevance';
                const order = nextNode.inputs.order || 'desc';

                processedItems = [...processedItems].sort((a, b) => {
                    let aVal, bVal;

                    if (field === 'time') {
                        aVal = new Date(a.pubDate);
                        bVal = new Date(b.pubDate);
                    } else {
                        aVal = a.relevanceScore || 0;
                        bVal = b.relevanceScore || 0;
                    }

                    return order === 'desc' ? bVal - aVal : aVal - bVal;
                });
            } else if (nextNode.type === 'limit') {
                const count = parseInt(nextNode.inputs.count) || 10;
                processedItems = processedItems.slice(0, count);
            }

            queue.push({ node: nextNode, items: processedItems });
        }
    }

    return currentItems;
}

// Refresh preview
function refreshPreview() {
    const preview = document.getElementById('rss-preview');
    if (!preview) return;

    // Build the workflow
    const workflow = buildWorkflow();
    if (!workflow) {
        preview.innerHTML = '<div class="preview-placeholder">Build your flowchart to see RSS preview</div>';
        return;
    }

    // Show loading state
    preview.innerHTML = '<div class="preview-placeholder">Generating preview...</div>';

    // Process workflow with real data
    processWorkflow(workflow).then(items => {
        displayRSSPreview(items);
    }).catch(error => {
        console.error('Error processing workflow:', error);
        preview.innerHTML = '<div class="preview-placeholder">Error generating preview. Check your configuration.</div>';
    });
}

// Display RSS preview
function displayRSSPreview(items) {
    const preview = document.getElementById('rss-preview');
    if (items.length === 0) {
        preview.innerHTML = '<div class="preview-placeholder">No items match your criteria</div>';
        return;
    }

    const itemsHTML = items.map(item => `
        <div class="rss-item">
            <div class="rss-item-title">${item.title}</div>
            <div class="rss-item-description">${item.description}</div>
            <div class="rss-item-meta">
                ${new Date(item.pubDate).toLocaleDateString()} • ${item.source}
            </div>
        </div>
    `).join('');

    preview.innerHTML = itemsHTML;
}

// Save RSS configuration
function saveRSSConfig() {
    const config = {
        nodes: Array.from(rssNodes.values()),
        connections: rssConnections
    };

    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rss-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Load RSS configuration
function loadRSSConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const config = JSON.parse(e.target.result);
                loadConfiguration(config);
            } catch (error) {
                alert('Invalid configuration file');
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

// Load configuration
function loadConfiguration(config) {
    // Clear existing
    rssNodes.clear();
    rssConnections = [];
    canvas.innerHTML = '';

    // Load nodes
    config.nodes.forEach(nodeData => {
        const node = createNodeFromData(nodeData);
        // Set input values
        Object.keys(nodeData.inputs).forEach(key => {
            const input = node.querySelector(`[data-field="${key}"]`);
            if (input) {
                input.value = nodeData.inputs[key];
            }
        });
    });

    // Load connections
    rssConnections = config.connections || [];

    setTimeout(() => {
        updateConnections();
        refreshPreview();
    }, 100);
}

// Generate custom RSS feed
function generateCustomRSS() {
    const workflow = buildWorkflow();
    if (!workflow) {
        alert('Please create a complete workflow with at least one source and an output node.');
        return;
    }

    const configData = {
        nodes: Array.from(rssNodes.values()),
        connections: rssConnections
    };

    const encodedConfig = btoa(JSON.stringify(configData));
    const rssUrl = `/api/custom-rss?config=${encodedConfig}`;

    alert(`Custom RSS feed URL:\n${window.location.origin}${rssUrl}\n\n(Copy this URL to subscribe to your custom feed)`);
}

// Copy RSS URL to clipboard
function copyRSSUrl() {
    const workflow = buildWorkflow();
    if (!workflow) {
        alert('Please create a complete workflow first.');
        return;
    }

    const configData = {
        nodes: Array.from(rssNodes.values()),
        connections: rssConnections
    };

    const encodedConfig = btoa(JSON.stringify(configData));
    const rssUrl = `${window.location.origin}/api/custom-rss?config=${encodedConfig}`;

    navigator.clipboard.writeText(rssUrl).then(() => {
        alert('RSS URL copied to clipboard!');
    }).catch(() => {
        prompt('Copy this RSS URL:', rssUrl);
    });
}
