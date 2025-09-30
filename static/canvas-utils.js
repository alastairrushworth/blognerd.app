// Canvas utilities for zoom, pan, and transformation
let zoomLevel = 1;
let canvasScale = 1;

// Canvas panning functionality
let canvasOffset = { x: 0, y: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0 };
const minZoom = 0.25;
const maxZoom = 3;
const zoomStep = 0.25;

// Canvas transform function
function updateCanvasTransform() {
    const canvas = document.getElementById('rss-canvas');
    if (canvas) {
        canvas.style.transform = `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`;
        canvas.style.transformOrigin = '0 0';
    }
}

// Zoom Functions
function updateZoom() {
    updateCanvasTransform();
    
    // Update zoom level display
    const zoomDisplay = document.getElementById('zoom-level');
    if (zoomDisplay) {
        zoomDisplay.textContent = `${Math.round(canvasScale * 100)}%`;
    }
}

function zoomIn() {
    if (canvasScale < maxZoom) {
        canvasScale = Math.min(maxZoom, canvasScale + zoomStep);
        updateZoom();
    }
}

function zoomOut() {
    if (canvasScale > minZoom) {
        canvasScale = Math.max(minZoom, canvasScale - zoomStep);
        updateZoom();
    }
}

function resetZoom() {
    canvasScale = 1;
    canvasOffset = { x: 0, y: 0 };
    updateZoom();
}

function addZoomEventListeners() {
    const canvas = document.getElementById('rss-canvas');
    if (canvas) {
        // Mouse wheel zoom
        canvas.addEventListener('wheel', function(e) {
            e.preventDefault();
            
            if (e.deltaY < 0) {
                zoomIn();
            } else {
                zoomOut();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey || e.metaKey) {
                if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    zoomIn();
                } else if (e.key === '-') {
                    e.preventDefault();
                    zoomOut();
                } else if (e.key === '0') {
                    e.preventDefault();
                    resetZoom();
                }
            }
        });
    }
}