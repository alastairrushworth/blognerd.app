// RSS Builder module for custom RSS workflow canvas
let rssNodes = new Map();
let rssConnections = [];
let selectedNode = null;
let nodeIdCounter = 1;
let isDraggingNode = false;
let dragOffset = { x: 0, y: 0 };
let isConnecting = false;
let connectionStart = null;
const canvas = document.getElementById('rss-canvas');
const customRSSBuilder = document.getElementById('custom-rss-builder');

// Node type configurations
const nodeTypes = {
    'search-source': {
        icon: '🔍',
        title: 'Search Source',
        inputs: ['Query', 'Type'],
        hasOutput: true,
        color: '#2196F3'
    },
    'text-filter': {
        icon: '🔤',
        title: 'Text Filter',
        inputs: ['Pattern', 'Type', 'Field', 'Mode'],
        hasInput: true,
        hasOutput: true,
        color: '#FF9800'
    },
    'sort': {
        icon: '⬇️',
        title: 'Sort',
        inputs: ['Field'],
        hasInput: true,
        hasOutput: true,
        color: '#795548'
    },
    'limit': {
        icon: '#️⃣',
        title: 'Limit',
        inputs: ['Count'],
        hasInput: true,
        hasOutput: true,
        color: '#607D8B'
    },
    'output': {
        icon: '📄',
        title: 'RSS Output',
        inputs: ['Title', 'Description'],
        hasInput: true,
        hasOutput: false,
        color: '#F44336'
    }
};

// Initialize drag and drop for palette items
function initializePalette() {
    const paletteItems = document.querySelectorAll('.palette-item');
    paletteItems.forEach(item => {
        item.addEventListener('dragstart', function(e) {
            // Add a specific marker to identify palette drops
            e.dataTransfer.setData('text/plain', this.dataset.nodeType);
            e.dataTransfer.setData('application/x-palette-item', 'true');
        });
    });

    canvas.addEventListener('dragover', function(e) {
        e.preventDefault();
    });

    canvas.addEventListener('drop', function(e) {
        e.preventDefault();
        
        // Check if any node is currently being dragged by our custom system
        const isDraggingCustomNode = document.querySelector('.canvas-node.selected');
        if (isDraggingCustomNode) {
            return; // Don't create nodes while custom dragging is active
        }
        
        // Only accept drops from palette items
        const isPaletteItem = e.dataTransfer.getData('application/x-palette-item');
        if (!isPaletteItem) {
            return; // Ignore drops that aren't from palette
        }
        
        const nodeType = e.dataTransfer.getData('text/plain');
        if (!nodeType) return;
        
        const rect = canvas.getBoundingClientRect();
        // Account for zoom and pan offset when calculating position
        const x = ((e.clientX - rect.left) - canvasOffset.x) / canvasScale;
        const y = ((e.clientY - rect.top) - canvasOffset.y) / canvasScale;
        createNode(nodeType, x, y);
    });
    
    // Cancel connections when clicking on empty canvas
    canvas.addEventListener('click', function(e) {
        // Only cancel if clicking on the canvas itself (not on nodes or connection points)
        if (e.target === canvas && isConnecting) {
            isConnecting = false;
            clearConnectionVisuals();
            connectionStart = null;
            clearConnectionStatus();
        }
    });
    
    // Add panning functionality to canvas container
    const canvasContainer = document.querySelector('.builder-canvas-container');
    
    canvasContainer.addEventListener('mousedown', function(e) {
        // Only start panning if clicking on the container itself or canvas background
        if (e.target === canvasContainer || e.target === canvas) {
            isPanning = true;
            panStart.x = e.clientX - canvasOffset.x;
            panStart.y = e.clientY - canvasOffset.y;
            canvasContainer.classList.add('panning');
            e.preventDefault();
        }
    });
    
    document.addEventListener('mousemove', function(e) {
        if (isPanning) {
            canvasOffset.x = e.clientX - panStart.x;
            canvasOffset.y = e.clientY - panStart.y;
            updateCanvasTransform();
            e.preventDefault();
        }
    });
    
    document.addEventListener('mouseup', function(e) {
        if (isPanning) {
            isPanning = false;
            canvasContainer.classList.remove('panning');
        }
    });
}

// Create a new node
function createNode(nodeType, x, y) {
    const nodeId = 'node-' + nodeIdCounter++;
    const config = nodeTypes[nodeType];
    
    const node = document.createElement('div');
    node.className = 'canvas-node';
    node.id = nodeId;
    node.style.left = x + 'px';
    node.style.top = y + 'px';
    node.style.borderColor = config.color;
    node.draggable = false; // Disable HTML5 drag and drop to prevent conflicts
    
    // Aggressively prevent any HTML5 drag behavior
    node.addEventListener('dragstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
    
    // Also prevent drag on all child elements
    node.addEventListener('dragstart', function(e) {
        if (e.target !== node) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true); // Use capture phase

    let inputsHTML = '';
    if (config.inputs) {
        config.inputs.forEach(input => {
            if (input === 'Type' || input === 'Mode' || input === 'Field') {
                let options = '';
                if (input === 'Type') {
                    if (nodeType === 'text-filter') {
                        options = '<option value="keyword">Keyword</option><option value="regex">Regular Expression</option>';
                    } else {
                        options = '<option value="pages">Posts</option><option value="sites">RSS Feeds</option>';
                    }
                } else if (input === 'Mode') {
                    options = '<option value="include">Include</option><option value="exclude">Exclude</option>';
                } else if (input === 'Field') {
                    if (nodeType === 'text-filter') {
                        options = '<option value="title">Title</option><option value="description">Description</option><option value="content">Content</option>';
                    } else {
                        options = '<option value="timestamp">Timestamp</option><option value="relevance">Relevance</option>';
                    }
                }
                inputsHTML += `<div>${input}: <select class="node-select" data-field="${input.toLowerCase()}">${options}</select></div>`;
            } else {
                inputsHTML += `<div>${input}: <input type="text" class="node-input" data-field="${input.toLowerCase()}" placeholder="${input}"></div>`;
            }
        });
    }

    node.innerHTML = `
        <div class="node-header">
            <div class="node-title">
                <span>${config.icon}</span>
                <span>${config.title}</span>
            </div>
            <button class="node-delete" onclick="deleteNode('${nodeId}')">×</button>
        </div>
        <div class="node-content">
            ${inputsHTML}
        </div>
        ${config.hasInput ? '<div class="connection-point connection-input"></div>' : ''}
        ${config.hasOutput ? '<div class="connection-point connection-output"></div>' : ''}
    `;

    canvas.appendChild(node);
    
    const nodeData = {
        id: nodeId,
        type: nodeType,
        x: x,
        y: y,
        config: config,
        inputs: {},
        connections: { inputs: [], outputs: [] }
    };
    
    rssNodes.set(nodeId, nodeData);

    // Add event listeners
    makeDraggable(node);
    addInputListeners(node, nodeData);
    addConnectionListeners(node, nodeData);

    // Auto-refresh preview when nodes change
    setTimeout(refreshPreview, 100);

    return nodeData;
}

// Make nodes draggable
function makeDraggable(node) {
    let isDragging = false;
    let startX, startY, nodeX, nodeY, startCanvasX, startCanvasY;

    node.addEventListener('mousedown', function(e) {
        if (e.target.classList.contains('node-delete') || 
            e.target.classList.contains('node-input') || 
            e.target.classList.contains('node-select') ||
            e.target.classList.contains('connection-point')) {
            return;
        }

        // Aggressively prevent any browser drag detection
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Clear any existing dataTransfer to prevent stale data issues
        try {
            if (e.dataTransfer) {
                e.dataTransfer.clearData();
            }
        } catch (ex) {
            // Ignore errors if dataTransfer is not available
        }

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        nodeX = parseInt(node.style.left) || 0;
        nodeY = parseInt(node.style.top) || 0;
        
        // Also capture start position in canvas coordinates for consistent calculation
        const rect = canvas.getBoundingClientRect();
        startCanvasX = ((e.clientX - rect.left) - canvasOffset.x) / canvasScale;
        startCanvasY = ((e.clientY - rect.top) - canvasOffset.y) / canvasScale;

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        
        // Select node
        document.querySelectorAll('.canvas-node').forEach(n => n.classList.remove('selected'));
        node.classList.add('selected');
        selectedNode = node.id;
    });

    function onMouseMove(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        // Convert current mouse position to canvas coordinates (same as drop handler)
        const rect = canvas.getBoundingClientRect();
        const currentCanvasX = ((e.clientX - rect.left) - canvasOffset.x) / canvasScale;
        const currentCanvasY = ((e.clientY - rect.top) - canvasOffset.y) / canvasScale;
        
        // Calculate delta in canvas coordinates using captured start position
        const deltaX = currentCanvasX - startCanvasX;
        const deltaY = currentCanvasY - startCanvasY;
        
        const newX = nodeX + deltaX;
        const newY = nodeY + deltaY;
        
        // Allow nodes to be positioned anywhere on the expanded canvas
        node.style.left = newX + 'px';
        node.style.top = newY + 'px';

        // Update node data
        const nodeData = rssNodes.get(node.id);
        if (nodeData) {
            nodeData.x = newX;
            nodeData.y = newY;
        }

        // Use lightweight position updates during dragging for smooth performance
        if (!node._updateTimeout) {
            node._updateTimeout = setTimeout(() => {
                updateConnectionPositions(); // Use lightweight updates during drag
                node._updateTimeout = null;
            }, 16); // ~60fps
        }
    }

    function onMouseUp(e) {
        if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
            
            // Clear any pending updates and do a final update
            if (node._updateTimeout) {
                clearTimeout(node._updateTimeout);
                node._updateTimeout = null;
            }
            updateConnections();
            
            // Remove selection after drag is complete
            node.classList.remove('selected');
            selectedNode = null;
        }
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}

// Add input event listeners
function addInputListeners(node, nodeData) {
    const inputs = node.querySelectorAll('.node-input, .node-select');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            const field = this.dataset.field;
            nodeData.inputs[field] = this.value;
            refreshPreview();
        });
    });
}

// Helper functions for connection visual feedback
function showConnectionStatus(message, type = 'info') {
    // Remove existing status message
    clearConnectionStatus();
    
    const statusDiv = document.createElement('div');
    statusDiv.id = 'connection-status';
    statusDiv.style.position = 'absolute';
    statusDiv.style.top = '10px';
    statusDiv.style.left = '50%';
    statusDiv.style.transform = 'translateX(-50%)';
    statusDiv.style.padding = '8px 16px';
    statusDiv.style.borderRadius = '4px';
    statusDiv.style.fontSize = '14px';
    statusDiv.style.fontWeight = 'bold';
    statusDiv.style.zIndex = '1000';
    statusDiv.style.pointerEvents = 'none';
    statusDiv.textContent = message;
    
    if (type === 'success') {
        statusDiv.style.backgroundColor = '#4CAF50';
        statusDiv.style.color = 'white';
    } else if (type === 'error') {
        statusDiv.style.backgroundColor = '#f44336';
        statusDiv.style.color = 'white';
    } else {
        statusDiv.style.backgroundColor = '#2196F3';
        statusDiv.style.color = 'white';
    }
    
    canvas.appendChild(statusDiv);
}

function clearConnectionStatus() {
    const existingStatus = document.getElementById('connection-status');
    if (existingStatus) {
        existingStatus.remove();
    }
}

function clearConnectionVisuals() {
    // Reset all connection points to default style
    document.querySelectorAll('.connection-point').forEach(point => {
        point.style.backgroundColor = '#1a73e8';
        point.style.transform = point.classList.contains('connection-input') ? 
            'translateY(-50%)' : 
            'translateY(-50%)';
    });
}

// Add connection event listeners
function addConnectionListeners(node, nodeData) {
    const connectionPoints = node.querySelectorAll('.connection-point');
    connectionPoints.forEach(point => {
        point.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            startConnection(nodeData.id, point.classList.contains('connection-output'));
        });
        
        // Add visual feedback on hover
        point.addEventListener('mouseenter', function(e) {
            if (connectionStart) {
                // Check if this is a valid connection target
                const isOutput = point.classList.contains('connection-output');
                const isInput = point.classList.contains('connection-input');
                
                if ((connectionStart.isOutput && isInput) || (!connectionStart.isOutput && isOutput)) {
                    if (connectionStart.nodeId !== nodeData.id) {
                        point.style.backgroundColor = '#4CAF50';
                        point.style.transform = point.classList.contains('connection-input') ? 
                            'translateY(-50%) scale(1.3)' : 
                            'translateY(-50%) scale(1.3)';
                    } else {
                        point.style.backgroundColor = '#f44336';
                    }
                } else {
                    point.style.backgroundColor = '#f44336';
                }
            } else {
                point.style.backgroundColor = '#2196F3';
                point.style.transform = point.classList.contains('connection-input') ? 
                    'translateY(-50%) scale(1.2)' : 
                    'translateY(-50%) scale(1.2)';
            }
        });
        
        point.addEventListener('mouseleave', function(e) {
            point.style.backgroundColor = '#1a73e8';
            point.style.transform = point.classList.contains('connection-input') ? 
                'translateY(-50%)' : 
                'translateY(-50%)';
        });
    });
}

// Start creating a connection
function startConnection(nodeId, isOutput) {
    if (isConnecting) {
        // Complete connection
        completeConnection(nodeId, !isOutput);
    } else {
        // Start connection
        isConnecting = true;
        connectionStart = { nodeId: nodeId, isOutput: isOutput };
        
        // Add visual indicator to starting node
        const startingNode = document.getElementById(nodeId);
        const startingPoint = startingNode.querySelector(isOutput ? '.connection-output' : '.connection-input');
        if (startingPoint) {
            startingPoint.style.backgroundColor = '#FF9800';
            startingPoint.style.transform = startingPoint.classList.contains('connection-input') ? 
                'translateY(-50%) scale(1.4)' : 
                'translateY(-50%) scale(1.4)';
        }
        
        // Add a status message to the canvas
        showConnectionStatus('Click on another node\'s connection point to connect');
    }
}

// Complete a connection
function completeConnection(targetNodeId, isTargetInput) {
    if (!connectionStart || 
        connectionStart.nodeId === targetNodeId ||
        connectionStart.isOutput === !isTargetInput) {
        // Invalid connection
        isConnecting = false;
        clearConnectionVisuals();
        connectionStart = null;
        showConnectionStatus('Invalid connection', 'error');
        setTimeout(() => clearConnectionStatus(), 2000);
        return;
    }

    // Check if connection already exists
    const from = connectionStart.isOutput ? connectionStart.nodeId : targetNodeId;
    const to = connectionStart.isOutput ? targetNodeId : connectionStart.nodeId;
    
    const existingConnection = rssConnections.find(conn => 
        conn.from === from && conn.to === to
    );
    
    if (existingConnection) {
        isConnecting = false;
        clearConnectionVisuals();
        connectionStart = null;
        showConnectionStatus('Connection already exists', 'error');
        setTimeout(() => clearConnectionStatus(), 2000);
        return;
    }

    const connection = {
        from: from,
        to: to,
        id: 'conn-' + Date.now()
    };

    rssConnections.push(connection);

    // Update node data
    const fromNode = rssNodes.get(connection.from);
    const toNode = rssNodes.get(connection.to);
    if (fromNode) fromNode.connections.outputs.push(connection.id);
    if (toNode) toNode.connections.inputs.push(connection.id);

    isConnecting = false;
    clearConnectionVisuals();
    connectionStart = null;
    updateConnections();
    refreshPreview();
    showConnectionStatus('Connection created successfully!', 'success');
    setTimeout(() => clearConnectionStatus(), 2000);
}

// Update connection positions only (lightweight, for during-drag updates)
function updateConnectionPositions() {
    const canvas = document.getElementById('rss-canvas');
    if (!canvas) return;

    rssConnections.forEach(connection => {
        const line = canvas.querySelector(`svg[data-connection-id="${connection.id}"]`);
        if (!line) return; // Connection SVG doesn't exist yet, skip

        const fromNode = document.getElementById(connection.from);
        const toNode = document.getElementById(connection.to);
        
        if (!fromNode || !toNode) return;

        // Use node positions directly
        const fromNodeX = parseInt(fromNode.style.left) || 0;
        const fromNodeY = parseInt(fromNode.style.top) || 0;
        const toNodeX = parseInt(toNode.style.left) || 0;
        const toNodeY = parseInt(toNode.style.top) || 0;
        
        const nodeWidth = 150;
        const nodeHeight = 80;
        
        const startX = fromNodeX + nodeWidth;
        const startY = fromNodeY + nodeHeight / 2;
        const endX = toNodeX;
        const endY = toNodeY + nodeHeight / 2;

        const minX = Math.min(startX, endX);
        const minY = Math.min(startY, endY);
        const width = Math.abs(endX - startX) + 40;
        const height = Math.abs(endY - startY) + 40;

        // Update SVG position and dimensions
        line.style.left = (minX - 20) + 'px';
        line.style.top = (minY - 20) + 'px';
        line.style.width = width + 'px';
        line.style.height = height + 'px';
        line.setAttribute('viewBox', `0 0 ${width} ${height}`);
        
        // Update path
        const path = line.querySelector('path:not([d*="M0,0"])'); // Find the main path, not the arrowhead
        if (path) {
            const controlX1 = (startX - minX + 20) + (endX - startX) * 0.3;
            const controlX2 = (startX - minX + 20) + (endX - startX) * 0.7;
            
            const pathData = `M ${startX - minX + 20} ${startY - minY + 20} C ${controlX1} ${startY - minY + 20} ${controlX2} ${endY - minY + 20} ${endX - minX + 20} ${endY - minY + 20}`;
            path.setAttribute('d', pathData);
        }
    });
}

// Update connection lines (full rebuild, for complete updates)
function updateConnections() {
    // Remove old connection lines more thoroughly
    const canvas = document.getElementById('rss-canvas');
    if (canvas) {
        // Remove all SVG connection elements
        canvas.querySelectorAll('.connection-line').forEach(line => line.remove());
        // Also remove any orphaned SVG elements that might be left behind
        canvas.querySelectorAll('svg[data-connection-id]').forEach(svg => svg.remove());
    }

    rssConnections.forEach(connection => {
        const fromNode = document.getElementById(connection.from);
        const toNode = document.getElementById(connection.to);
        
        if (!fromNode || !toNode) return;

        const fromPoint = fromNode.querySelector('.connection-output');
        const toPoint = toNode.querySelector('.connection-input');
        
        if (!fromPoint || !toPoint) return;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        line.className = 'connection-line';
        line.setAttribute('data-connection-id', connection.id); // Add identifier for position updates
        line.style.position = 'absolute';
        line.style.pointerEvents = 'none';
        line.style.zIndex = '1';
        
        // Use node positions directly instead of getBoundingClientRect to avoid coordinate issues
        const fromNodeX = parseInt(fromNode.style.left) || 0;
        const fromNodeY = parseInt(fromNode.style.top) || 0;
        const toNodeX = parseInt(toNode.style.left) || 0;
        const toNodeY = parseInt(toNode.style.top) || 0;
        
        // Connection points are positioned at the center-right (output) and center-left (input) of nodes
        const nodeWidth = 150; // Approximate node width
        const nodeHeight = 80; // Approximate node height
        
        const startX = fromNodeX + nodeWidth; // Right edge for output
        const startY = fromNodeY + nodeHeight / 2; // Vertical center
        const endX = toNodeX; // Left edge for input  
        const endY = toNodeY + nodeHeight / 2; // Vertical center

        const minX = Math.min(startX, endX);
        const minY = Math.min(startY, endY);
        const width = Math.abs(endX - startX) + 40;
        const height = Math.abs(endY - startY) + 40;

        line.style.left = (minX - 20) + 'px';
        line.style.top = (minY - 20) + 'px';
        line.style.width = width + 'px';
        line.style.height = height + 'px';
        line.setAttribute('viewBox', `0 0 ${width} ${height}`);

        // Create arrow marker definition
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', `arrowhead-${connection.id}`);
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        marker.setAttribute('markerUnits', 'strokeWidth');
        
        const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrowPath.setAttribute('d', 'M0,0 L0,7 L9,3.5 z');
        arrowPath.setAttribute('fill', '#1a73e8');
        
        marker.appendChild(arrowPath);
        defs.appendChild(marker);
        line.appendChild(defs);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const controlX1 = (startX - minX + 20) + (endX - startX) * 0.3;
        const controlX2 = (startX - minX + 20) + (endX - startX) * 0.7;
        
        path.setAttribute('d', `M ${startX - minX + 20} ${startY - minY + 20} C ${controlX1} ${startY - minY + 20} ${controlX2} ${endY - minY + 20} ${endX - minX + 20} ${endY - minY + 20}`);
        path.setAttribute('stroke', '#1a73e8');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', `url(#arrowhead-${connection.id})`);
        
        line.appendChild(path);
        canvas.appendChild(line);
    });
}

// Delete a node
function deleteNode(nodeId) {
    const node = document.getElementById(nodeId);
    if (node) {
        node.remove();
    }
    
    // Remove from data
    rssNodes.delete(nodeId);
    
    // Remove connections
    rssConnections = rssConnections.filter(conn => 
        conn.from !== nodeId && conn.to !== nodeId
    );
    
    // Update other nodes' connection data
    rssNodes.forEach(nodeData => {
        nodeData.connections.inputs = nodeData.connections.inputs.filter(connId => 
            !connId.includes(nodeId)
        );
        nodeData.connections.outputs = nodeData.connections.outputs.filter(connId => 
            !connId.includes(nodeId)
        );
    });

    updateConnections();
    refreshPreview();
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

// Process workflow with real API calls
async function processWorkflow(workflow) {
    let allItems = [];
    
    // Process each source
    for (const source of workflow.sources) {
        try {
            let items = [];
            
            if (source.type === 'search-source') {
                // Get search parameters from the node
                const query = source.inputs.query || '';
                const type = source.inputs.type || 'pages';
                
                if (!query.trim()) {
                    console.warn('Search source has no query configured');
                    continue;
                }
                
                // Make API call to the search endpoint
                const params = new URLSearchParams();
                params.set('qry', query);
                if (type === 'sites') params.set('type', 'feeds');
                
                const response = await fetch(`/api/search?${params.toString()}`);
                const data = await response.json();
                
                // Convert search results to RSS item format
                items = data.results ? data.results.slice(0, 10).map(result => ({
                    title: result.title,
                    description: result.description || result.title,
                    link: result.url,
                    pubDate: result.date || new Date().toISOString(),
                    source: `Search: ${query}`
                })) : [];
                
            } else if (source.type === 'search-source') {
                // For RSS sources, we'd need to fetch and parse the RSS feed
                // For now, we'll skip this or show a placeholder
                console.warn('RSS source processing not implemented yet');
                continue;
            }
            
            allItems = allItems.concat(items);
        } catch (error) {
            console.error(`Error processing source ${source.type}:`, error);
        }
    }
    
    // Apply filters and processors
    let processedItems = allItems;
    
    // Apply content filters
    for (const filter of workflow.filters) {
        if (filter.type === 'text-filter') {
            const pattern = filter.inputs.pattern || '';
            const mode = filter.inputs.mode || 'include';
            const field = filter.inputs.field || 'title';
            
            if (pattern.trim()) {
                const regex = new RegExp(pattern, 'i');
                processedItems = processedItems.filter(item => {
                    const text = item[field] || '';
                    const matches = regex.test(text);
                    return mode === 'include' ? matches : !matches;
                });
            }
        }
    }
    
    // Apply processors (sort, limit, etc.)
    for (const processor of workflow.processors) {
        if (processor.type === 'sort') {
            const field = processor.inputs.field || 'pubDate';
            const order = processor.inputs.order || 'desc';
            
            processedItems.sort((a, b) => {
                const aVal = new Date(a[field]);
                const bVal = new Date(b[field]);
                return order === 'desc' ? bVal - aVal : aVal - bVal;
            });
        } else if (processor.type === 'limit') {
            const count = parseInt(processor.inputs.count) || 10;
            processedItems = processedItems.slice(0, count);
        }
    }
    
    return processedItems;
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
        } else if (nodeData.type === 'text-filter') {
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

    return { sources, filters, processors, output };
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

// Create node from saved data
function createNodeFromData(nodeData) {
    const config = nodeTypes[nodeData.type];
    const node = document.createElement('div');
    node.className = 'canvas-node';
    node.id = nodeData.id;
    node.style.left = nodeData.x + 'px';
    node.style.top = nodeData.y + 'px';
    node.style.borderColor = config.color;
    node.draggable = false; // Disable HTML5 drag and drop to prevent conflicts
    
    // Aggressively prevent any HTML5 drag behavior
    node.addEventListener('dragstart', function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    });
    
    // Also prevent drag on all child elements  
    node.addEventListener('dragstart', function(e) {
        if (e.target !== node) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    }, true); // Use capture phase

    let inputsHTML = '';
    if (config.inputs) {
        config.inputs.forEach(input => {
            if (input === 'Type' || input === 'Mode' || input === 'Field') {
                let options = '';
                if (input === 'Type') {
                    if (nodeData.type === 'text-filter') {
                        options = '<option value="keyword">Keyword</option><option value="regex">Regular Expression</option>';
                    } else {
                        options = '<option value="pages">Posts</option><option value="sites">RSS Feeds</option>';
                    }
                } else if (input === 'Mode') {
                    options = '<option value="include">Include</option><option value="exclude">Exclude</option>';
                } else if (input === 'Field') {
                    if (nodeData.type === 'text-filter') {
                        options = '<option value="title">Title</option><option value="description">Description</option><option value="content">Content</option>';
                    } else {
                        options = '<option value="timestamp">Timestamp</option><option value="relevance">Relevance</option>';
                    }
                }
                inputsHTML += `<div>${input}: <select class="node-select" data-field="${input.toLowerCase()}">${options}</select></div>`;
            } else {
                inputsHTML += `<div>${input}: <input type="text" class="node-input" data-field="${input.toLowerCase()}" placeholder="${input}"></div>`;
            }
        });
    }

    node.innerHTML = `
        <div class="node-header">
            <div class="node-title">
                <span>${config.icon}</span>
                <span>${config.title}</span>
            </div>
            <button class="node-delete" onclick="deleteNode('${nodeData.id}')">×</button>
        </div>
        <div class="node-content">
            ${inputsHTML}
        </div>
        ${config.hasInput ? '<div class="connection-point connection-input"></div>' : ''}
        ${config.hasOutput ? '<div class="connection-point connection-output"></div>' : ''}
    `;

    canvas.appendChild(node);
    rssNodes.set(nodeData.id, nodeData);

    makeDraggable(node);
    addInputListeners(node, nodeData);
    addConnectionListeners(node, nodeData);

    return node;
}

// Generate custom RSS feed
function generateCustomRSS() {
    console.log('Generate RSS clicked');
    const workflow = buildWorkflow();
    if (!workflow) {
        alert('Please create a complete workflow with at least one source and an output node.');
        return;
    }

    console.log('Workflow built:', workflow);

    // Create the config data in the format expected by the backend
    const configData = {
        nodes: Array.from(rssNodes.values()),
        connections: rssConnections
    };
    
    console.log('Config data:', configData);
    
    try {
        // Strip out Unicode characters from the config data before encoding
        const configDataCleaned = JSON.parse(JSON.stringify(configData, (key, value) => {
            if (typeof value === 'string') {
                // Replace emoji and other Unicode with simple text
                return value.replace(/🔍/g, 'Search').replace(/📄/g, 'Output').replace(/[^\x00-\x7F]/g, '');
            }
            return value;
        }));
        
        const configString = JSON.stringify(configDataCleaned);
        const encodedConfig = btoa(configString);
        const rssUrl = `/api/custom-rss?config=${encodedConfig}`;
        
        console.log('Generated RSS URL:', rssUrl);
        
        // Open the RSS feed in a new window instead of just showing an alert
        window.open(rssUrl, '_blank');
        
    } catch (error) {
        console.error('Error generating RSS URL:', error);
        alert('Error generating RSS feed: ' + error.message);
    }
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
    
    // Strip out Unicode characters from the config data before encoding
    const configDataCleaned = JSON.parse(JSON.stringify(configData, (key, value) => {
        if (typeof value === 'string') {
            // Replace emoji and other Unicode with simple text
            return value.replace(/🔍/g, 'Search').replace(/📄/g, 'Output').replace(/[^\x00-\x7F]/g, '');
        }
        return value;
    }));
    
    const configString = JSON.stringify(configDataCleaned);
    const encodedConfig = btoa(configString);
    const rssUrl = `${window.location.origin}/api/custom-rss?config=${encodedConfig}`;
    
    navigator.clipboard.writeText(rssUrl).then(() => {
        alert('RSS URL copied to clipboard!');
    }).catch(() => {
        prompt('Copy this RSS URL:', rssUrl);
    });
}

// Show/hide custom RSS builder based on selected tab
function updateCustomRSSVisibility() {
    console.log('updateCustomRSSVisibility called, currentSearchType:', currentSearchType);
    const customBuilder = document.getElementById('custom-rss-builder');
    const resultsContainer = document.querySelector('.results-container');
    const filtersContainer = document.querySelector('.filters');
    
    console.log('customBuilder found:', !!customBuilder);
    console.log('resultsContainer found:', !!resultsContainer);
    console.log('filtersContainer found:', !!filtersContainer);
    
    if (currentSearchType === 'custom') {
        if (customBuilder) {
            console.log('Setting customBuilder to block');
            customBuilder.style.display = 'block';
            // Initialize if first time
            const canvas = document.getElementById('rss-canvas');
            if (canvas && canvas.children.length === 0) {
                console.log('Initializing palette');
                initializePalette();
            }
        }
        if (resultsContainer) {
            console.log('Hiding results container');
            resultsContainer.style.display = 'none';
        }
        if (filtersContainer) {
            console.log('Hiding filters container');
            filtersContainer.style.display = 'none';
        }
    } else {
        if (customBuilder) {
            console.log('Hiding custom builder');
            customBuilder.style.display = 'none';
        }
        if (resultsContainer) {
            console.log('Showing results container');
            resultsContainer.style.display = 'block';
        }
        if (filtersContainer) {
            console.log('Showing filters container');
            filtersContainer.style.display = 'flex';
        }
    }
}