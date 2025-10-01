// Custom RSS Builder Core - State and Configuration

// Custom RSS Builder Variables
let rssNodes = new Map();
let rssConnections = [];
let selectedNode = null;
let nodeIdCounter = 1;
let isDraggingNode = false;
let isDraggingExistingNode = false;
let dragOffset = { x: 0, y: 0 };
let isConnecting = false;
let connectionStart = null;
const canvas = document.getElementById('rss-canvas');
const customRSSBuilder = document.getElementById('custom-rss-builder');

// Zoom functionality
let zoomLevel = 1;
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
    console.log('updateCustomRSSVisibility called, currentSearchType:', currentSearchType);
    const customBuilder = document.getElementById('custom-rss-builder');
    const resultsContainer = document.querySelector('.results-container');

    console.log('customBuilder found:', !!customBuilder);
    console.log('resultsContainer found:', !!resultsContainer);

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
    } else {
        if (customBuilder) {
            console.log('Hiding custom builder');
            customBuilder.style.display = 'none';
        }
        if (resultsContainer) {
            console.log('Showing results container');
            resultsContainer.style.display = 'block';
        }
    }
}
