// Custom RSS Builder Core - State and Configuration

// Custom RSS Builder Variables
let rssNodes = new Map();
let rssConnections = [];
let selectedNode = null;
let nodeIdCounter = 1;
let isDraggingExistingNode = false;
let isConnecting = false;
let connectionStart = null;
const canvas = document.getElementById('rss-canvas');
const customRSSBuilder = document.getElementById('custom-rss-builder');

// Zoom functionality
let canvasScale = 1;
const minZoom = 0.25;
const maxZoom = 3;
const zoomStep = 0.25;

// Node type configurations
const nodeTypes = {
    'rss-source': {
        icon: '📡',
        title: 'RSS Source',
        inputs: ['URL'],
        hasOutput: true,
        color: '#4CAF50'
    },
    'search-source': {
        icon: '🔍',
        title: 'Search Source',
        inputs: ['Query', 'Type'],
        hasOutput: true,
        color: '#2196F3'
    },
    'content-filter': {
        icon: '🔤',
        title: 'Content Filter',
        inputs: ['Pattern', 'Type', 'Field', 'Mode'],
        hasInput: true,
        hasOutput: true,
        color: '#FF9800'
    },
    'sort': {
        icon: '⬇️',
        title: 'Sort',
        inputs: ['Field', 'Order'],
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

// Show/hide custom RSS builder based on selected tab
function updateCustomRSSVisibility() {
    const customBuilder = document.getElementById('custom-rss-builder');
    const resultsContainer = document.querySelector('.results-container');

    if (currentSearchType === 'custom') {
        if (customBuilder) {
            customBuilder.style.display = 'block';
            initializePalette();
        }
        if (resultsContainer) {
            resultsContainer.style.display = 'none';
        }
    } else {
        if (customBuilder) {
            customBuilder.style.display = 'none';
        }
        if (resultsContainer) {
            resultsContainer.style.display = 'block';
        }
    }
}
