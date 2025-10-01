// Custom RSS Builder - Node Management

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
    node.draggable = false;

    let inputsHTML = '';
    if (config.inputs) {
        config.inputs.forEach(input => {
            if (input === 'Type' || input === 'Mode' || input === 'Field' || input === 'Order') {
                let options = '';
                if (input === 'Type') {
                    // Type is only for content-filter now
                    options = '<option value="keyword">Keyword</option><option value="regex">Regular Expression</option>';
                } else if (input === 'Mode') {
                    options = '<option value="include">Include</option><option value="exclude">Exclude</option>';
                } else if (input === 'Field') {
                    options = '<option value="title">Title</option><option value="description">Description</option><option value="content">Content</option>';
                } else if (input === 'Order') {
                    options = '<option value="desc">Newest First</option><option value="asc">Oldest First</option>';
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

    // Prevent HTML5 drag
    const preventDrag = function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };

    node.addEventListener('dragstart', preventDrag, true);
    node.addEventListener('drag', preventDrag, true);

    node.querySelectorAll('*').forEach(child => {
        child.draggable = false;
        child.addEventListener('dragstart', preventDrag, true);
        child.addEventListener('drag', preventDrag, true);
    });

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

// Delete a node
function deleteNode(nodeId) {
    const node = document.getElementById(nodeId);
    if (node) {
        node.remove();
    }

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

// Create node from saved data
function createNodeFromData(nodeData) {
    const config = nodeTypes[nodeData.type];
    const node = document.createElement('div');
    node.className = 'canvas-node';
    node.id = nodeData.id;
    node.style.left = nodeData.x + 'px';
    node.style.top = nodeData.y + 'px';
    node.style.borderColor = config.color;
    node.draggable = false;

    let inputsHTML = '';
    if (config.inputs) {
        config.inputs.forEach(input => {
            if (input === 'Type' || input === 'Mode' || input === 'Field' || input === 'Order') {
                let options = '';
                if (input === 'Type') {
                    // Type is only for content-filter now
                    options = '<option value="keyword">Keyword</option><option value="regex">Regular Expression</option>';
                } else if (input === 'Mode') {
                    options = '<option value="include">Include</option><option value="exclude">Exclude</option>';
                } else if (input === 'Field') {
                    options = '<option value="title">Title</option><option value="description">Description</option><option value="content">Content</option>';
                } else if (input === 'Order') {
                    options = '<option value="desc">Newest First</option><option value="asc">Oldest First</option>';
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

    const preventDrag = function(e) {
        e.preventDefault();
        e.stopPropagation();
        return false;
    };

    node.addEventListener('dragstart', preventDrag, true);
    node.addEventListener('drag', preventDrag, true);

    node.querySelectorAll('*').forEach(child => {
        child.draggable = false;
        child.addEventListener('dragstart', preventDrag, true);
        child.addEventListener('drag', preventDrag, true);
    });

    rssNodes.set(nodeData.id, nodeData);

    makeDraggable(node);
    addInputListeners(node, nodeData);
    addConnectionListeners(node, nodeData);

    return node;
}
