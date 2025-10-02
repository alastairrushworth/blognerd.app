// Custom RSS Builder - Zoom Controls

// Zoom Functions
function updateZoom() {
    if (canvas) {
        canvas.style.transform = `scale(${canvasScale})`;
        canvas.style.transformOrigin = '0 0';

        // Update zoom level display
        const zoomDisplay = document.getElementById('zoom-level');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${Math.round(canvasScale * 100)}%`;
        }
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
    updateZoom();
}

function addZoomEventListeners() {
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
