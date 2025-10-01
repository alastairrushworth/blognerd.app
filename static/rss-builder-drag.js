// Custom RSS Builder - Drag and Drop

// Track if palette has been initialized to prevent duplicate event listeners
let paletteInitialized = false;

// Initialize drag and drop for palette items
function initializePalette() {
    // Prevent multiple initializations which would add duplicate event listeners
    if (paletteInitialized) {
        return;
    }

    paletteInitialized = true;

    const paletteItems = document.querySelectorAll('.palette-item');
    paletteItems.forEach(item => {
        item.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', this.dataset.nodeType);
            e.dataTransfer.setData('application/x-palette-item', 'true');
        });
    });

    canvas.addEventListener('dragover', function(e) {
        e.preventDefault();
    });

    canvas.addEventListener('drop', function(e) {
        e.preventDefault();

        // If we're dragging an existing node, ignore the drop event
        if (isDraggingExistingNode) {
            return;
        }

        // Only create nodes from palette items
        const isPaletteItem = e.dataTransfer.getData('application/x-palette-item');
        if (!isPaletteItem) {
            return;
        }

        const nodeType = e.dataTransfer.getData('text/plain');
        if (!nodeType) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left + canvas.scrollLeft) / canvasScale;
        const y = (e.clientY - rect.top + canvas.scrollTop) / canvasScale;
        createNode(nodeType, x, y);
    });

    // Cancel connections when clicking on empty canvas
    canvas.addEventListener('click', function(e) {
        if (e.target === canvas && isConnecting) {
            isConnecting = false;
            clearConnectionVisuals();
            connectionStart = null;
            clearConnectionStatus();
        }
    });
}

// Make nodes draggable
function makeDraggable(node) {
    let isDragging = false;
    let startX, startY, nodeX, nodeY;
    let hasMoved = false; // Track if the node has actually moved

    node.addEventListener('mousedown', function(e) {
        if (e.target.classList.contains('node-delete') ||
            e.target.classList.contains('node-input') ||
            e.target.classList.contains('node-select') ||
            e.target.classList.contains('connection-point')) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        isDragging = true;
        hasMoved = false; // Reset movement flag
        startX = e.clientX;
        startY = e.clientY;
        nodeX = parseInt(node.style.left) || 0;
        nodeY = parseInt(node.style.top) || 0;

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

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Check if we've moved at least 3 pixels (to prevent accidental micro-movements)
        if (!hasMoved && (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3)) {
            hasMoved = true;
            isDraggingExistingNode = true;
        }

        if (!hasMoved) return; // Don't update position until we've confirmed movement

        const newX = nodeX + deltaX;
        const newY = nodeY + deltaY;

        // Constrain to canvas bounds (account for zoom)
        const canvasRect = canvas.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const maxX = (canvasRect.width / canvasScale) - (nodeRect.width / canvasScale);
        const maxY = (canvasRect.height / canvasScale) - (nodeRect.height / canvasScale);

        const constrainedX = Math.max(0, Math.min(newX, maxX));
        const constrainedY = Math.max(0, Math.min(newY, maxY));

        node.style.left = constrainedX + 'px';
        node.style.top = constrainedY + 'px';

        // Update node data
        const nodeData = rssNodes.get(node.id);
        if (nodeData) {
            nodeData.x = constrainedX;
            nodeData.y = constrainedY;
        }

        // During drag, only update positions - don't recreate SVGs
        if (!node._updateTimeout) {
            node._updateTimeout = setTimeout(() => {
                updateConnectionPositionsOnly();
                node._updateTimeout = null;
            }, 16); // ~60fps
        }
    }

    function onMouseUp(e) {
        if (isDragging) {
            e.preventDefault();
            e.stopPropagation();

            // Clear any pending position-only updates before doing full rebuild
            if (node._updateTimeout) {
                clearTimeout(node._updateTimeout);
                node._updateTimeout = null;
            }

            // Do a final FULL update ONLY if we actually moved
            if (hasMoved) {
                updateConnections();
            }
        }
        isDragging = false;

        // Clear the global flag ONLY if we actually set it (hasMoved)
        if (hasMoved) {
            setTimeout(() => {
                isDraggingExistingNode = false;
            }, 100);
        }

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    }
}
