// Custom RSS Builder - Connection Management

// Helper functions for connection visual feedback
function showConnectionStatus(message, type = 'info') {
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
        completeConnection(nodeId, !isOutput);
    } else {
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
function updateConnectionPositionsOnly() {
    rssConnections.forEach(connection => {
        // CRITICAL: Use a more specific selector to ensure we get exactly ONE line per connection
        const line = document.querySelector(`svg.connection-line[data-connection-id="${connection.id}"]`);

        if (!line) {
            console.warn(`No SVG found for connection ${connection.id} during position update`);
            return;
        }

        const fromNode = document.getElementById(connection.from);
        const toNode = document.getElementById(connection.to);

        if (!fromNode || !toNode) {
            console.warn(`Missing nodes for connection ${connection.id}`);
            return;
        }

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

        // Update SVG container position and size
        line.style.left = (minX - 20) + 'px';
        line.style.top = (minY - 20) + 'px';
        line.style.width = width + 'px';
        line.style.height = height + 'px';
        line.setAttribute('viewBox', `0 0 ${width} ${height}`);

        // Update the path element
        const path = line.querySelector('path[stroke]');
        if (path) {
            const controlX1 = (startX - minX + 20) + (endX - startX) * 0.3;
            const controlX2 = (startX - minX + 20) + (endX - startX) * 0.7;

            path.setAttribute('d', `M ${startX - minX + 20} ${startY - minY + 20} C ${controlX1} ${startY - minY + 20} ${controlX2} ${endY - minY + 20} ${endX - minX + 20} ${endY - minY + 20}`);
        }
    });
}

// Update connection lines (full rebuild, for complete updates)
function updateConnections() {
    const canvas = document.getElementById('rss-canvas');
    if (!canvas) return;

    console.log('=== updateConnections called ===');
    console.log('Total connections in data:', rssConnections.length);

    // CRITICAL FIX: Remove ALL existing connection-line SVG elements
    // Query for ALL SVGs with the connection-line class
    const existingLines = Array.from(canvas.querySelectorAll('svg.connection-line'));
    console.log(`Found ${existingLines.length} existing SVG lines to remove`);

    // Remove each one and verify
    existingLines.forEach((line, index) => {
        const connId = line.getAttribute('data-connection-id');
        console.log(`  Removing SVG #${index + 1} with connection-id: ${connId}`);
        line.remove();
    });

    // Double-check: make sure they're really gone
    const remainingLines = canvas.querySelectorAll('svg.connection-line');
    if (remainingLines.length > 0) {
        console.error(`WARNING: ${remainingLines.length} SVG lines still remain after removal!`);
        remainingLines.forEach(line => {
            console.error(`  Orphaned line: ${line.getAttribute('data-connection-id')}`);
            line.remove(); // Force remove
        });
    } else {
        console.log('✓ All old SVG lines successfully removed');
    }

    // Now create fresh SVG elements for each connection in our data
    console.log(`Creating ${rssConnections.length} new connection lines`);
    rssConnections.forEach(connection => {
        const fromNode = document.getElementById(connection.from);
        const toNode = document.getElementById(connection.to);

        if (!fromNode || !toNode) return;

        const fromPoint = fromNode.querySelector('.connection-output');
        const toPoint = toNode.querySelector('.connection-input');

        if (!fromPoint || !toPoint) return;

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        // CRITICAL: For SVG elements, must use setAttribute for class, not className
        line.setAttribute('class', 'connection-line');
        line.setAttribute('data-connection-id', connection.id);
        line.style.position = 'absolute';
        line.style.pointerEvents = 'none';
        line.style.zIndex = '1';

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

        line.style.left = (minX - 20) + 'px';
        line.style.top = (minY - 20) + 'px';
        line.style.width = width + 'px';
        line.style.height = height + 'px';
        line.setAttribute('viewBox', `0 0 ${width} ${height}`);

        // Create arrow marker
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

        // DEBUG: Check if SVG has the right class BEFORE adding to DOM
        console.log(`  About to append SVG with className: "${line.className.baseVal}"`);

        canvas.appendChild(line);

        // DEBUG: Immediately verify it was added
        const wasAdded = canvas.contains(line);
        console.log(`  ✓ Created SVG for connection ${connection.id} (${connection.from} → ${connection.to}), wasAdded: ${wasAdded}`);

        // DEBUG: Check if we can query it back
        const canQuery = canvas.querySelector(`svg.connection-line[data-connection-id="${connection.id}"]`);
        console.log(`  Can query back: ${!!canQuery}`);
    });

    // Final verification
    const finalCount = canvas.querySelectorAll('svg.connection-line').length;
    const allSvgs = canvas.querySelectorAll('svg');
    console.log(`=== updateConnections complete ===`);
    console.log(`Canvas element: ${canvas.id}, total children: ${canvas.children.length}`);
    console.log(`Total SVG elements: ${allSvgs.length}, with .connection-line class: ${finalCount}`);
    console.log(`Expected: ${rssConnections.length}`);

    if (finalCount !== rssConnections.length) {
        console.error(`MISMATCH: Created ${rssConnections.length} but found ${finalCount} in DOM!`);
        console.error(`All SVGs in canvas:`, allSvgs);
    }
}
