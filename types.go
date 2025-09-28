package main

import (
	"html/template"
	"sync"
	"time"
)

// SearchResult represents a single search result
type SearchResult struct {
	URL           string  `json:"url"`
	Title         string  `json:"title"`
	Subtitle      string  `json:"subtitle"`
	Date          string  `json:"date"`
	Score         float64 `json:"pcscore"`
	BaseDomain    string  `json:"basedomain"`
	IsFeed        bool    `json:"is_feed_search"`
	RSSURL        string  `json:"rss_url"`
	OriginalDomain string  `json:"original_domain"`
	// Latest post fields (only populated for feeds when include_posts=true)
	LatestPostTitle    string `json:"latest_post_title,omitempty"`
	LatestPostURL      string `json:"latest_post_url,omitempty"`
	LatestPostDate     string `json:"latest_post_date,omitempty"`
	LatestPostSnippet  string `json:"latest_post_snippet,omitempty"`
}

// SearchResponse represents the API response for search requests
type SearchResponse struct {
	Results     []SearchResult `json:"results"`
	TimeTaken   float64        `json:"time_taken"`
	TotalResults int           `json:"total_results"`
}

// RSSCacheItem represents a cached RSS feed
type RSSCacheItem struct {
	content   string
	timestamp time.Time
}

// CustomRSSNode represents a node in the custom RSS workflow
type CustomRSSNode struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	X           float64                `json:"x"`
	Y           float64                `json:"y"`
	Inputs      map[string]interface{} `json:"inputs"`
	Config      map[string]interface{} `json:"config"`
	Connections struct {
		Inputs  []string `json:"inputs"`
		Outputs []string `json:"outputs"`
	} `json:"connections"`
}

// CustomRSSConnection represents a connection between nodes
type CustomRSSConnection struct {
	From string `json:"from"`
	To   string `json:"to"`
	ID   string `json:"id"`
}

// CustomRSSConfig represents the configuration for a custom RSS workflow
type CustomRSSConfig struct {
	Nodes       []CustomRSSNode       `json:"nodes"`
	Connections []CustomRSSConnection `json:"connections"`
}

// App represents the main application with all its dependencies
type App struct {
	templates   *template.Template
	pineconeAPI *PineconeClient
	voyageAPI   *VoyageClient
	rssCache    map[string]RSSCacheItem
	rssMutex    sync.RWMutex
}