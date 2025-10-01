// Page Initialization - Run after all modules are loaded

// Initialize the page
initializePage();

// Initialize zoom functionality
if (canvas) {
    addZoomEventListeners();
    updateZoom();
}
