package main

import (
	"html/template"
	"sync"
	"time"

	"blognerd/internal/clients/openai"
	"blognerd/internal/clients/pinecone"
	"blognerd/internal/clients/voyage"
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

// EmailDigest represents a user's email digest configuration
type EmailDigest struct {
	ID          string            `json:"id"`
	UserID      string            `json:"user_id"`
	Name        string            `json:"name"`
	Frequency   string            `json:"frequency"` // daily, weekly, monthly
	Sources     []DigestSource    `json:"sources"`
	Rules       []DigestRule      `json:"rules"`
	Preferences DigestPreferences `json:"preferences"`
	Active      bool              `json:"active"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// DigestSource represents a single source/search query in a digest
type DigestSource struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Query      string `json:"query"`
	MaxResults int    `json:"max_results"`
}

// DigestRule represents a filtering rule applied to combined source results
type DigestRule struct {
	ID    string `json:"id"`
	Type  string `json:"type"`  // site_exclude, keyword_exclude, etc.
	Value string `json:"value"` // domain, keyword, etc.
}

// DigestPreferences represents delivery preferences for a digest
type DigestPreferences struct {
	DeliveryTime string `json:"delivery_time"` // "08:00"
	Timezone     string `json:"timezone"`      // "America/Los_Angeles"
	IncludeImages bool  `json:"include_images"`
}

// User represents a user in the mock auth system
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
}

// Session represents a user session
type Session struct {
	Token     string    `json:"token"`
	UserID    string    `json:"user_id"`
	ExpiresAt time.Time `json:"expires_at"`
}

// DigestPreviewResponse represents the preview of a digest with actual content
type DigestPreviewResponse struct {
	DigestName string                   `json:"digest_name"`
	Sources    []DigestSourceWithResults `json:"sources"`
	TotalItems int                      `json:"total_items"`
}

// DigestSourceWithResults represents a source with its search results
type DigestSourceWithResults struct {
	Name    string         `json:"name"`
	Query   string         `json:"query"`
	Results []SearchResult `json:"results"`
}

// SourcePreviewResponse represents a preview of a single source
type SourcePreviewResponse struct {
	SourceName string         `json:"source_name"`
	Query      string         `json:"query"`
	Results    []SearchResult `json:"results"`
	TotalItems int            `json:"total_items"`
}

// CombinedPreviewResponse represents combined results from all sources
type CombinedPreviewResponse struct {
	Results    []SearchResult `json:"results"`
	TotalItems int            `json:"total_items"`
	BySource   map[string]int `json:"by_source"` // source_name -> count
}

// App represents the main application with all its dependencies
type App struct {
	templates   *template.Template
	pineconeAPI *pinecone.Client
	voyageAPI   *voyage.Client
	openAIAPI   *openai.Client
	rssCache    map[string]RSSCacheItem
	rssMutex    sync.RWMutex
	// Mock data stores (in production these would be in a database)
	users        map[string]User          // email -> User
	sessions     map[string]Session       // token -> Session
	digests      map[string]EmailDigest   // digestID -> EmailDigest
	userDigests  map[string][]string      // userID -> []digestID
	digestsMutex sync.RWMutex
	authMutex    sync.RWMutex
}