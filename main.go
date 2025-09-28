package main

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

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

type SearchResponse struct {
	Results     []SearchResult `json:"results"`
	TimeTaken   float64        `json:"time_taken"`
	TotalResults int           `json:"total_results"`
}

type RSSCacheItem struct {
	content   string
	timestamp time.Time
}

type App struct {
	templates   *template.Template
	pineconeAPI *PineconeClient
	voyageAPI   *VoyageClient
	rssCache    map[string]RSSCacheItem
	rssMutex    sync.RWMutex
}

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using system environment variables")
	}

	// Initialize clients
	pineconeAPI := NewPineconeClient(
		os.Getenv("PINECONE_API_KEY"),
		os.Getenv("PINECONE_V2_HOST"),
		os.Getenv("PINECONE_V2_INDEX"),
	)

	voyageAPI := NewVoyageClient(os.Getenv("VOYAGE_API_KEY"))

	// Load templates
	templates := template.Must(template.ParseGlob("templates/*.html"))

	app := &App{
		templates:   templates,
		pineconeAPI: pineconeAPI,
		voyageAPI:   voyageAPI,
		rssCache:    make(map[string]RSSCacheItem),
	}

	// Setup routes
	r := mux.NewRouter()
	
	// Static files
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("static/"))))
	
	// Routes
	r.HandleFunc("/", app.handleHome).Methods("GET")
	r.HandleFunc("/search", app.handleSearch).Methods("GET")
	r.HandleFunc("/api/search", app.handleAPISearch).Methods("GET", "POST")
	r.HandleFunc("/api/export/opml", app.handleOPMLExport).Methods("GET", "POST")
	r.HandleFunc("/api/export/csv", app.handleCSVExport).Methods("GET", "POST")
	r.HandleFunc("/rss", app.handleRSSFeed).Methods("GET")

	// Start server
	port := "8000"
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}

	fmt.Printf("🤓 BlogNerd server starting on http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func (app *App) handleHome(w http.ResponseWriter, r *http.Request) {
	data := map[string]interface{}{
		"Query":       r.URL.Query().Get("qry"),
		"SearchType":  getStringDefault(r.URL.Query().Get("type"), "pages"),
		"SearchContent": r.URL.Query().Get("content"),
		"SearchTime":  r.URL.Query().Get("time"),
		"Results":     nil,
		"TimeTaken":   0.0,
		"TotalResults": 0,
	}

	w.Header().Set("Content-Type", "text/html")
	err := app.templates.ExecuteTemplate(w, "index.html", data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (app *App) handleSearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("qry")
	if query == "" {
		// Default search
		query = "ai, software development, startups, tech, data, computers since:last_3days length:1000 type:blog score:0.6 lang:en"
	}

	results, timeTaken := app.performSearch(query, r.URL.Query())

	data := map[string]interface{}{
		"Query":        r.URL.Query().Get("qry"),
		"SearchType":   getStringDefault(r.URL.Query().Get("type"), "pages"),
		"SearchContent": r.URL.Query().Get("content"),
		"SearchTime":   r.URL.Query().Get("time"),
		"Results":      results,
		"TimeTaken":    timeTaken,
		"TotalResults": len(results),
	}

	w.Header().Set("Content-Type", "text/html")
	err := app.templates.ExecuteTemplate(w, "index.html", data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (app *App) handleAPISearch(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("qry")
	if query == "" {
		http.Error(w, "Query parameter 'qry' is required", http.StatusBadRequest)
		return
	}

	results, timeTaken := app.performSearch(query, r.URL.Query())

	response := SearchResponse{
		Results:      results,
		TimeTaken:    timeTaken,
		TotalResults: len(results),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (app *App) handleOPMLExport(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("qry")
	if query == "" {
		http.Error(w, "Query parameter 'qry' is required", http.StatusBadRequest)
		return
	}

	// Ensure this is a feeds search
	if !strings.Contains(query, "type:feeds") {
		query += " type:feeds"
	}

	results, _ := app.performSearch(query, r.URL.Query())

	// Filter only feed results
	var feedResults []SearchResult
	for _, result := range results {
		if result.IsFeed {
			feedResults = append(feedResults, result)
		}
	}

	opmlContent := generateOPML(feedResults, query)

	w.Header().Set("Content-Type", "application/xml")
	w.Header().Set("Content-Disposition", "attachment; filename=\"feeds.opml\"")
	w.Write([]byte(opmlContent))
}

func (app *App) handleCSVExport(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("qry")
	if query == "" {
		http.Error(w, "Query parameter 'qry' is required", http.StatusBadRequest)
		return
	}

	// Ensure this is a feeds search
	if !strings.Contains(query, "type:feeds") {
		query += " type:feeds"
	}

	results, _ := app.performSearch(query, r.URL.Query())

	// Filter only feed results
	var feedResults []SearchResult
	for _, result := range results {
		if result.IsFeed {
			feedResults = append(feedResults, result)
		}
	}

	csvContent := generateCSV(feedResults)

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=\"feeds.csv\"")
	w.Write([]byte(csvContent))
}


func (app *App) performSearch(query string, params map[string][]string) ([]SearchResult, float64) {
	start := time.Now()

	// Build search query with filters
	searchQuery := query
	searchType := getStringDefault(getParam(params, "type"), "pages")
	content := getParam(params, "content")
	timeFilter := getParam(params, "time")
	includePosts := getParam(params, "include_posts") == "true"
	sortBy := getParam(params, "sort")

	if searchType == "sites" {
		searchQuery += " type:feeds"
	} else {
		if content != "" {
			searchQuery += " type:" + content
		}
		// Add time filter only if explicitly specified
		if timeFilter != "" {
			searchQuery += " since:last_" + timeFilter
		}
	}

	// Perform search using API clients
	results, err := app.searchContent(searchQuery, 50)
	if err != nil {
		log.Printf("Search error: %v", err)
		return []SearchResult{}, 0.0
	}

	// If this is a feed search and include_posts is true, fetch latest posts
	if searchType == "sites" && includePosts && len(results) > 0 {
		latestPosts := app.getLatestPostsForFeeds(results)
		
		// Populate latest post fields for each feed result
		for i := range results {
			if latestPost, exists := latestPosts[results[i].OriginalDomain]; exists {
				results[i].LatestPostTitle = latestPost.Title
				results[i].LatestPostURL = latestPost.URL
				results[i].LatestPostDate = latestPost.Date
				results[i].LatestPostSnippet = latestPost.Subtitle
			}
		}
	}

	// Apply sorting for posts (not feeds)
	if searchType == "pages" && sortBy == "time" && len(results) > 0 {
		app.sortResultsByTime(results)
	}

	timeTaken := time.Since(start).Seconds()
	return results, timeTaken
}

func (app *App) searchContent(query string, maxResults int) ([]SearchResult, error) {
	log.Printf("DEBUG searchContent: Received query: '%s'", query)
	
	// Parse query for filters and special syntax
	parsedQuery, err := parseSearchQuery(query)
	if err != nil {
		return nil, fmt.Errorf("failed to parse query: %w", err)
	}
	log.Printf("DEBUG searchContent: Parsed query - Text: '%s', Filters: %+v", parsedQuery.Text, parsedQuery.Filters)
	var embedding []float64

	// Check for "like:" syntax
	if parsedQuery.IsLike {
		// Determine if this is a domain (for similar blogs) or a full URL (for similar posts)
		isDomain := !strings.HasPrefix(parsedQuery.LikeURL, "http://") && !strings.HasPrefix(parsedQuery.LikeURL, "https://")
		
		if isDomain || strings.Contains(query, "type:feeds") {
			// For feeds search or domain-based search, find similar blogs
			embedding, err = app.getSimilarBlogEmbedding(parsedQuery.LikeURL)
			if err != nil {
				return nil, fmt.Errorf("failed to get embedding for similar blogs: %w", err)
			}
		} else {
			// For posts search, get embedding from Pinecone for this URL
			embedding, err = app.pineconeAPI.GetEmbedding(parsedQuery.LikeURL)
			if err != nil {
				return nil, fmt.Errorf("failed to get embedding for URL: %w", err)
			}
		}
	} else if parsedQuery.Text != "" && parsedQuery.Text != "a" {
		// Get embedding from Voyage API
		embedding, err = app.voyageAPI.GetEmbedding(parsedQuery.Text)
		if err != nil {
			return nil, fmt.Errorf("failed to get embedding: %w", err)
		}
	} else if len(parsedQuery.Filters) > 0 {
		// For site: queries with no text, use a generic search term
		embedding, err = app.voyageAPI.GetEmbedding("content")
		if err != nil {
			return nil, fmt.Errorf("failed to get embedding for filtered search: %w", err)
		}
	}

	// Query Pinecone - determine namespace
	namespace := "blaze-content-v3" // Default to content namespace
	log.Printf("DEBUG: Checking for 'type:feeds' in query: '%s'", query)
	if strings.Contains(query, "type:feeds") {
		namespace = "blaze-feeds-v2"
		log.Printf("DEBUG: Using feeds namespace: %s", namespace)
	} else {
		log.Printf("DEBUG: Using content namespace: %s", namespace)
	}
	log.Printf("DEBUG: Final namespace: %s, Filters: %+v", namespace, parsedQuery.Filters)

	// Debug logging for site: queries
	if strings.Contains(query, "site:") {
		log.Printf("DEBUG: Original query: %s", query)
		log.Printf("DEBUG: Parsed text: %s", parsedQuery.Text)
		log.Printf("DEBUG: Filters: %+v", parsedQuery.Filters)
		log.Printf("DEBUG: Namespace: %s", namespace)
	}

	pineconeResults, err := app.pineconeAPI.Query(namespace, embedding, parsedQuery.Filters, maxResults)
	if err != nil {
		return nil, fmt.Errorf("pinecone query failed: %w", err)
	}

	// Debug logging for results
	log.Printf("DEBUG: Pinecone returned %d results", len(pineconeResults))
	if strings.Contains(query, "site:") {
		log.Printf("DEBUG SITE SEARCH: Query=%s, Namespace=%s, Filters=%+v, Results=%d", 
			query, namespace, parsedQuery.Filters, len(pineconeResults))
		for i, result := range pineconeResults {
			if i < 3 { // Log first 3 results
				log.Printf("DEBUG SITE RESULT %d: ID=%s, Score=%.3f, Metadata keys=%v", 
					i, result.ID, result.Score, getMetadataKeys(result.Metadata))
				if baseURL := getMetadataString(result.Metadata, "baseurl"); baseURL != "" {
					log.Printf("DEBUG SITE RESULT %d: baseurl=%s", i, baseURL)
				}
				if baseURL := getMetadataString(result.Metadata, "base_url"); baseURL != "" {
					log.Printf("DEBUG SITE RESULT %d: base_url=%s", i, baseURL)
				}
			}
		}
	}

	// Convert to search results
	results := make([]SearchResult, len(pineconeResults))
	isFeedSearch := strings.Contains(query, "type:feeds")

	for i, result := range pineconeResults {
		title := getMetadataString(result.Metadata, "title")
		subtitle := getMetadataString(result.Metadata, "subtitle")
		
		// For feed searches, construct different title/subtitle and URL mapping
		if isFeedSearch {
			ownerName := getMetadataString(result.Metadata, "owner_name")
			if ownerName != "" {
				title = ownerName
			}
			subtitle = getMetadataString(result.Metadata, "short_summary")
			
			baseURL := getMetadataString(result.Metadata, "baseurl")
			results[i] = SearchResult{
				URL:            baseURL,  // Use baseurl for feeds
				Title:          title,
				Subtitle:       subtitle,
				Date:           "", // Feeds don't have dates
				Score:          result.Score,
				BaseDomain:     cleanURL(baseURL),
				IsFeed:         isFeedSearch,
				RSSURL:         result.ID, // RSS feed URL is stored in Pinecone ID
				OriginalDomain: baseURL, // Keep full URL format to match Pinecone schema
			}
		} else {
			baseURL := getMetadataString(result.Metadata, "base_url")
			results[i] = SearchResult{
				URL:            result.ID,
				Title:          title,
				Subtitle:       subtitle,
				Date:           formatDate(getMetadataString(result.Metadata, "dt_published")),
				Score:          result.Score,
				BaseDomain:     cleanURL(baseURL),
				IsFeed:         isFeedSearch,
				RSSURL:         "",
				OriginalDomain: baseURL,
			}
		}
	}

	// Sort by time in descending order if this is a site search for posts (not feeds)
	if !isFeedSearch && strings.Contains(query, "site:") {
		// Create a slice with both results and original metadata for sorting
		type resultWithMetadata struct {
			result   SearchResult
			metadata map[string]interface{}
		}
		
		resultsWithMeta := make([]resultWithMetadata, len(results))
		for i, result := range results {
			resultsWithMeta[i] = resultWithMetadata{
				result:   result,
				metadata: pineconeResults[i].Metadata,
			}
		}
		
		// Sort by time - more recent dates come first
		sort.Slice(resultsWithMeta, func(i, j int) bool {
			dateI := parseTimeFromMetadata(resultsWithMeta[i].metadata)
			dateJ := parseTimeFromMetadata(resultsWithMeta[j].metadata)
			return dateI.After(dateJ)
		})
		
		// Extract sorted results back to the results array
		for i, rwm := range resultsWithMeta {
			results[i] = rwm.result
		}
	}

	return results, nil
}

// getLatestPostsForFeeds fetches the latest post for each feed's base URL
func (app *App) getLatestPostsForFeeds(feedResults []SearchResult) map[string]SearchResult {
	latestPosts := make(map[string]SearchResult)
	
	// Use a generic embedding for filtering (we only care about base_url filtering)
	genericEmbedding, err := app.voyageAPI.GetEmbedding("content")
	if err != nil {
		log.Printf("Error getting generic embedding for latest posts: %v", err)
		return latestPosts
	}
	
	// Query latest post for each feed (limit to first 20 feeds for performance)
	maxFeeds := 20
	if len(feedResults) < maxFeeds {
		maxFeeds = len(feedResults)
	}
	
	for i := 0; i < maxFeeds; i++ {
		feed := feedResults[i]
		baseURL := feed.OriginalDomain
		
		if baseURL == "" {
			continue
		}
		
		// Create filter for this specific base_url
		filters := map[string]interface{}{
			"base_url": map[string]interface{}{"$eq": baseURL},
		}
		
		// Query content namespace for posts from this base URL
		results, err := app.pineconeAPI.Query("blaze-content-v3", genericEmbedding, filters, 50)
		if err != nil {
			log.Printf("Error querying latest posts for %s: %v", baseURL, err)
			continue
		}
		
		if len(results) == 0 {
			continue
		}
		
		// Sort results by date to find the latest
		sort.Slice(results, func(i, j int) bool {
			dateI := parseTimeFromMetadata(results[i].Metadata)
			dateJ := parseTimeFromMetadata(results[j].Metadata)
			return dateI.After(dateJ) // Most recent first
		})
		
		// Get the latest post
		latestResult := results[0]
		latestPost := SearchResult{
			URL:      latestResult.ID,
			Title:    getMetadataString(latestResult.Metadata, "title"),
			Subtitle: getMetadataString(latestResult.Metadata, "subtitle"),
			Date:     formatDate(getMetadataString(latestResult.Metadata, "dt_published")),
		}
		
		latestPosts[baseURL] = latestPost
	}
	
	return latestPosts
}

// sortResultsByTime sorts search results by publication date (most recent first)
func (app *App) sortResultsByTime(results []SearchResult) {
	sort.Slice(results, func(i, j int) bool {
		dateI := parseDate(results[i].Date)
		dateJ := parseDate(results[j].Date)
		return dateI.After(dateJ) // Most recent first
	})
}

// parseDate parses various date formats and returns a time.Time
func parseDate(dateStr string) time.Time {
	if dateStr == "" {
		return time.Time{} // Return zero time for empty dates
	}
	
	// Try multiple date formats
	formats := []string{
		"2006-01-02", // Our standard format
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
	}
	
	for _, format := range formats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return t
		}
	}
	
	return time.Time{} // Return zero time if parsing fails
}


func getParam(params map[string][]string, key string) string {
	if values, ok := params[key]; ok && len(values) > 0 {
		return values[0]
	}
	return ""
}

func getStringDefault(value, defaultValue string) string {
	if value == "" {
		return defaultValue
	}
	return value
}

func getMetadataString(metadata map[string]interface{}, key string) string {
	if val, ok := metadata[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

func formatDate(dateStr string) string {
	if dateStr == "" {
		return ""
	}
	
	// Try multiple date formats
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	
	for _, format := range formats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return t.Format("2006-01-02")
		}
	}
	
	// If all parsing fails, try to extract just the date part if it looks like a datetime string
	if len(dateStr) >= 10 && dateStr[4] == '-' && dateStr[7] == '-' {
		return dateStr[:10]
	}
	
	return dateStr
}

func getMetadataKeys(metadata map[string]interface{}) []string {
	keys := make([]string, 0, len(metadata))
	for key := range metadata {
		keys = append(keys, key)
	}
	return keys
}

func cleanURL(url string) string {
	// Remove http:// and https:// schemes
	url = strings.TrimPrefix(url, "https://")
	url = strings.TrimPrefix(url, "http://")
	
	// Remove www. prefix
	url = strings.TrimPrefix(url, "www.")
	
	// Remove trailing slash
	url = strings.TrimSuffix(url, "/")
	
	return url
}

func parseTimeFromMetadata(metadata map[string]interface{}) time.Time {
	dateStr := getMetadataString(metadata, "dt_published")
	if dateStr == "" {
		return time.Time{} // Return zero time if no date
	}
	
	// Try multiple date formats
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02T15:04:05Z",
		"2006-01-02T15:04:05",
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	
	for _, format := range formats {
		if t, err := time.Parse(format, dateStr); err == nil {
			return t
		}
	}
	
	return time.Time{} // Return zero time if parsing fails
}

func generateOPML(feedResults []SearchResult, query string) string {
	opml := `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
<head>
<title>BlogNerd Feed Export</title>
<dateCreated>` + time.Now().Format(time.RFC1123) + `</dateCreated>
<dateModified>` + time.Now().Format(time.RFC1123) + `</dateModified>
<ownerName>blognerd.app</ownerName>
<ownerEmail>noreply@blognerd.app</ownerEmail>
<ownerId>https://blognerd.app</ownerId>
<docs>http://www.opml.org/spec2</docs>
<expansionState></expansionState>
<vertScrollState>1</vertScrollState>
<windowTop>61</windowTop>
<windowLeft>304</windowLeft>
<windowBottom>562</windowBottom>
<windowRight>842</windowRight>
</head>
<body>
<outline text="BlogNerd Search Results: ` + escapeXML(query) + `" title="BlogNerd Search Results">
`

	for _, feed := range feedResults {
		title := escapeXML(feed.Title)
		if title == "" {
			title = escapeXML(feed.BaseDomain)
		}
		
		subtitle := escapeXML(feed.Subtitle)
		rssURL := escapeXML(feed.RSSURL)
		htmlURL := escapeXML(feed.URL)
		
		opml += `<outline type="rss" text="` + title + `" title="` + title + `" xmlUrl="` + rssURL + `" htmlUrl="` + htmlURL + `"`
		if subtitle != "" {
			opml += ` description="` + subtitle + `"`
		}
		opml += `/>`
		opml += "\n"
	}

	opml += `</outline>
</body>
</opml>`

	return opml
}

func escapeXML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	return s
}

func generateCSV(feedResults []SearchResult) string {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// Write CSV header
	header := []string{"Title", "Description", "Website URL", "RSS Feed URL"}
	writer.Write(header)

	// Write feed data
	for _, feed := range feedResults {
		title := feed.Title
		if title == "" {
			title = feed.BaseDomain
		}
		
		record := []string{
			title,
			feed.Subtitle,
			feed.URL,
			feed.RSSURL,
		}
		writer.Write(record)
	}

	writer.Flush()
	return buf.String()
}


func (app *App) getSimilarBlogEmbedding(domain string) ([]float64, error) {
	// First, search for the specific domain in feeds using a generic embedding to filter by baseurl
	genericEmbedding, err := app.voyageAPI.GetEmbedding("blog content")
	if err != nil {
		return nil, fmt.Errorf("failed to get generic embedding: %w", err)
	}
	
	domainFilters := map[string]interface{}{
		"baseurl": map[string]interface{}{"$eq": domain},
	}
	
	// Search for the specific domain in feeds to get its ID
	domainResults, err := app.pineconeAPI.Query("blaze-feeds-v2", genericEmbedding, domainFilters, 1)
	if err != nil {
		return nil, fmt.Errorf("failed to find domain in feeds: %w", err)
	}
	
	if len(domainResults) == 0 {
		// If we can't find the exact domain, use the domain text as fallback
		return app.voyageAPI.GetEmbedding(domain)
	}
	
	// Get the embedding from the found domain entry using the feeds namespace
	return app.pineconeAPI.GetEmbeddingFromNamespace(domainResults[0].ID, "blaze-feeds-v2")
}

func (app *App) convertFeedResults(pineconeResults []PineconeMatch) []SearchResult {
	results := make([]SearchResult, len(pineconeResults))
	for i, result := range pineconeResults {
		title := getMetadataString(result.Metadata, "title")
		ownerName := getMetadataString(result.Metadata, "owner_name")
		if ownerName != "" {
			title = ownerName
		}
		subtitle := getMetadataString(result.Metadata, "short_summary")
		baseURL := getMetadataString(result.Metadata, "baseurl")
		
		results[i] = SearchResult{
			URL:            baseURL,  // Use baseurl for feeds
			Title:          title,
			Subtitle:       subtitle,
			Date:           "", // Feeds don't have dates
			Score:          result.Score,
			BaseDomain:     cleanURL(baseURL),
			IsFeed:         true,
			RSSURL:         result.ID, // RSS feed URL is stored in Pinecone ID
			OriginalDomain: baseURL,
		}
	}
	return results
}

func (app *App) handleRSSFeed(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("qry")
	if query == "" {
		http.Error(w, "Query parameter 'qry' is required", http.StatusBadRequest)
		return
	}

	// Create cache key from all parameters
	cacheKey := r.URL.RawQuery

	// Check cache first
	app.rssMutex.RLock()
	if cached, exists := app.rssCache[cacheKey]; exists {
		// Cache for 10 minutes
		if time.Since(cached.timestamp) < 10*time.Minute {
			app.rssMutex.RUnlock()
			w.Header().Set("Content-Type", "application/rss+xml; charset=utf-8")
			w.Write([]byte(cached.content))
			return
		}
	}
	app.rssMutex.RUnlock()

	// Perform search
	results, _ := app.performSearch(query, r.URL.Query())

	// Generate RSS feed
	rssContent := app.generateRSSFeed(results, query, r)

	// Cache the result
	app.rssMutex.Lock()
	app.rssCache[cacheKey] = RSSCacheItem{
		content:   rssContent,
		timestamp: time.Now(),
	}
	app.rssMutex.Unlock()

	// Clean old cache entries occasionally
	go app.cleanRSSCache()

	w.Header().Set("Content-Type", "application/rss+xml; charset=utf-8")
	w.Write([]byte(rssContent))
}

func (app *App) generateRSSFeed(results []SearchResult, query string, r *http.Request) string {
	// Limit results to 50 items for RSS feed
	maxItems := 50
	if len(results) > maxItems {
		results = results[:maxItems]
	}

	// Get search parameters for feed metadata
	searchType := getStringDefault(r.URL.Query().Get("type"), "pages")
	content := r.URL.Query().Get("content")
	timeParam := r.URL.Query().Get("time")

	// Build feed title
	feedTitle := fmt.Sprintf("BlogNerd Search: %s", query)
	if content != "" {
		feedTitle += fmt.Sprintf(" (%s)", content)
	}
	if timeParam != "" {
		feedTitle += fmt.Sprintf(" - %s", timeParam)
	}

	feedDescription := fmt.Sprintf("RSS feed for BlogNerd search: %s", query)
	if searchType == "sites" {
		feedDescription = fmt.Sprintf("RSS feeds matching: %s", query)
	} else {
		feedDescription = fmt.Sprintf("Blog posts matching: %s", query)
	}

	// Build RSS XML
	rss := `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>` + escapeXML(feedTitle) + `</title>
<description>` + escapeXML(feedDescription) + `</description>
<link>https://blognerd.app/?qry=` + escapeXML(query) + `</link>
<atom:link href="https://blognerd.app/rss?` + escapeXML(r.URL.RawQuery) + `" rel="self" type="application/rss+xml" />
<lastBuildDate>` + time.Now().Format(time.RFC1123) + `</lastBuildDate>
<generator>BlogNerd</generator>
<ttl>600</ttl>
`

	for _, result := range results {
		// Skip feed results when generating RSS (we want individual posts)
		if result.IsFeed {
			continue
		}

		itemTitle := result.Title
		if itemTitle == "" {
			itemTitle = result.BaseDomain
		}

		itemDescription := result.Subtitle
		if itemDescription == "" {
			itemDescription = "No description available"
		}

		// Parse and format publication date
		var pubDate string
		if result.Date != "" {
			if parsedDate := parseDate(result.Date); !parsedDate.IsZero() {
				pubDate = parsedDate.Format(time.RFC1123)
			} else {
				pubDate = time.Now().Format(time.RFC1123)
			}
		} else {
			pubDate = time.Now().Format(time.RFC1123)
		}

		rss += `<item>
<title>` + escapeXML(itemTitle) + `</title>
<description>` + escapeXML(itemDescription) + `</description>
<link>` + escapeXML(result.URL) + `</link>
<guid isPermaLink="true">` + escapeXML(result.URL) + `</guid>
<pubDate>` + pubDate + `</pubDate>
<source>` + escapeXML(result.BaseDomain) + `</source>
</item>
`
	}

	rss += `</channel>
</rss>`

	return rss
}

func (app *App) cleanRSSCache() {
	app.rssMutex.Lock()
	defer app.rssMutex.Unlock()

	// Remove cache entries older than 1 hour
	cutoff := time.Now().Add(-1 * time.Hour)
	for key, item := range app.rssCache {
		if item.timestamp.Before(cutoff) {
			delete(app.rssCache, key)
		}
	}
}