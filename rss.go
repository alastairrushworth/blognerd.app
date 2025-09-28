package main

import (
	"fmt"
	"net/http"
	"time"
)

// handleRSSFeed processes RSS feed requests
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

// generateRSSFeed creates RSS XML from search results
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

// cleanRSSCache removes old entries from the RSS cache
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