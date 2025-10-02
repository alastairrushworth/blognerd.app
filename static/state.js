// Application State Management
let currentSearchType = '{{.SearchType}}' || 'pages';
let searchTimeout;
let showPosts = false;
let sortByTime = false;

// DOM Elements
const initialState = document.getElementById('initial-state');
const searchState = document.getElementById('search-state');
const initialSearch = document.getElementById('initial-search');
const searchInput = document.getElementById('search-input');
const loadingDiv = document.getElementById('loading');
const resultsDiv = document.getElementById('results');
