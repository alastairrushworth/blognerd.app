package main

import (
	"bytes"
	"encoding/csv"
	"net/http"
	"strings"
	"time"
)

// handleOPMLExport exports search results as OPML
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

// handleCSVExport exports search results as CSV
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

// generateOPML creates OPML XML from feed results
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

// generateCSV creates CSV content from feed results
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