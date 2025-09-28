package main

import (
	"fmt"
	"log"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// SearchQuery contains parsed search parameters
type SearchQuery struct {
	Text     string
	Filters  map[string]interface{}
	SortBy   string
	Negation string
	IsLike   bool
	LikeURL  string
}

// parseSearchQuery parses the search query string and extracts filters
func parseSearchQuery(query string) (SearchQuery, error) {
	sq := SearchQuery{
		Text:    query,
		Filters: make(map[string]interface{}),
	}

	// Parse type: filter
	if match := regexp.MustCompile(`type:(\w+)`).FindStringSubmatch(query); len(match) > 1 {
		typeVal := match[1]
		sq.Text = strings.ReplaceAll(sq.Text, match[0], "")
		// Only add rsstype filter for non-feed searches
		if typeVal != "" && typeVal != "everything" && typeVal != "feeds" {
			sq.Filters["rsstype"] = map[string]interface{}{"$eq": getTypeMapping(typeVal)}
		}
	}

	// Parse sype: filter (site type)
	if match := regexp.MustCompile(`sype:(\w+)`).FindStringSubmatch(query); len(match) > 1 {
		stype := match[1]
		sq.Text = strings.ReplaceAll(sq.Text, match[0], "")
		if stype != "" && stype != "everything" {
			sq.Filters["site_type"] = map[string]interface{}{"$in": getSiteTypeMapping(stype)}
		}
	}

	// Parse oype: filter (owner type)
	if match := regexp.MustCompile(`oype:(\w+)`).FindStringSubmatch(query); len(match) > 1 {
		otype := match[1]
		sq.Text = strings.ReplaceAll(sq.Text, match[0], "")
		if otype != "" && otype != "everything" {
			if otype == "individual" {
				sq.Filters["owner_type"] = map[string]interface{}{"$eq": otype}
			} else {
				sq.Filters["owner_type"] = map[string]interface{}{"$ne": "individual"}
			}
		}
	}

	// Parse since: filter
	if match := regexp.MustCompile(`since:(\w+)`).FindStringSubmatch(query); len(match) > 1 {
		since := match[1]
		sq.Text = strings.ReplaceAll(sq.Text, match[0], "")
		if sinceSeconds, ok := getSinceMapping(since); ok {
			sq.Filters["unix_time"] = map[string]interface{}{"$gt": time.Now().Unix() - sinceSeconds}
		}
	}

	// Parse site: filter
	if match := regexp.MustCompile(`site:(.*?)( |$)`).FindStringSubmatch(query); len(match) > 1 {
		site := strings.TrimSpace(match[1])
		sq.Text = strings.ReplaceAll(sq.Text, match[0], "")
		// Use different field name based on whether this is a feeds search
		if strings.Contains(sq.Text, "type:feeds") || strings.Contains(query, "type:feeds") {
			sq.Filters["baseurl"] = map[string]interface{}{"$eq": site}
		} else {
			sq.Filters["base_url"] = map[string]interface{}{"$eq": site}
		}
	}

	// Parse lang: filter
	if match := regexp.MustCompile(`lang:([^\s]+)`).FindStringSubmatch(query); len(match) > 1 {
		lang := match[1]
		sq.Text = strings.ReplaceAll(sq.Text, match[0], "")
		sq.Filters["lang"] = map[string]interface{}{"$eq": lang}
	}

	// Parse score: filter
	if match := regexp.MustCompile(`score:([\d.]+)`).FindStringSubmatch(query); len(match) > 1 {
		if score, err := strconv.ParseFloat(match[1], 64); err == nil {
			sq.Text = strings.ReplaceAll(sq.Text, match[0], "")
			sq.Filters["score"] = map[string]interface{}{"$gt": score}
		}
	}

	// Parse length: filter
	if match := regexp.MustCompile(`length:(\d+)`).FindStringSubmatch(query); len(match) > 1 {
		if length, err := strconv.Atoi(match[1]); err == nil {
			sq.Text = strings.ReplaceAll(sq.Text, match[0], "")
			sq.Filters["length"] = map[string]interface{}{"$gt": length}
		}
	}

	// Parse like: filter
	if match := regexp.MustCompile(`like:([^\s]+)`).FindStringSubmatch(query); len(match) > 1 {
		sq.IsLike = true
		sq.LikeURL = match[1]
		sq.Text = strings.ReplaceAll(sq.Text, match[0], "")
	}

	// Parse negation <text>
	if match := regexp.MustCompile(`<([^>]+)>`).FindStringSubmatch(query); len(match) > 1 {
		sq.Negation = match[1]
		sq.Text = strings.ReplaceAll(sq.Text, match[0], "")
	}

	// Parse sort: filter
	if match := regexp.MustCompile(`sort:([^\s]+)`).FindStringSubmatch(query); len(match) > 1 {
		sq.SortBy = match[1]
		sq.Text = strings.ReplaceAll(sq.Text, match[0], "")
	}

	// Clean up the text
	sq.Text = strings.TrimSpace(sq.Text)
	if sq.Text == "" {
		sq.Text = "a" // Default fallback
	}

	return sq, nil
}

// getTypeMapping maps content types to internal values
func getTypeMapping(t string) string {
	mapping := map[string]string{
		"news":     "news",
		"academic": "academic",
		"arxiv":    "academic",
		"papers":   "academic",
		"journals": "academic",
		"blog":     "blog",
		"blogs":    "blog",
	}
	if val, ok := mapping[t]; ok {
		return val
	}
	return t
}

// getSiteTypeMapping maps site types to internal values
func getSiteTypeMapping(stype string) []string {
	mapping := map[string][]string{
		"blog":     {"blog", "individual / personal blog"},
		"periodic": {"periodic newsletter digest"},
		"eng":      {"company engineering blog"},
		"news":     {"news / media publication"},
	}
	if val, ok := mapping[stype]; ok {
		return val
	}
	return []string{stype}
}

// getSinceMapping maps time periods to seconds
func getSinceMapping(since string) (int64, bool) {
	mapping := map[string]int64{
		"yesterday":     24 * 60 * 60,
		"last_3days":    3 * 24 * 60 * 60,
		"last_week":     7 * 24 * 60 * 60,
		"last_month":    30 * 24 * 60 * 60,
		"last_3months":  3 * 30 * 24 * 60 * 60,
		"last_year":     365 * 24 * 60 * 60,
	}
	val, ok := mapping[since]
	return val, ok
}

// performSearch executes a search query with filters and returns results
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
		sortResultsByTime(results)
	}

	timeTaken := time.Since(start).Seconds()
	return results, timeTaken
}

// searchContent performs the actual search using Pinecone and Voyage APIs
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

// getSimilarBlogEmbedding gets an embedding for finding similar blogs
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

// convertFeedResults converts Pinecone matches to SearchResult format for feeds
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