package main

import (
	"fmt"
	"strings"
	"time"
)

// initDigestStore initializes the email digest data stores
func (app *App) initDigestStore() {
	app.digestsMutex.Lock()
	defer app.digestsMutex.Unlock()

	app.digests = make(map[string]EmailDigest)
	app.userDigests = make(map[string][]string)
}

// createDigest creates a new email digest for a user
func (app *App) createDigest(userID string, digest EmailDigest) (*EmailDigest, error) {
	app.digestsMutex.Lock()
	defer app.digestsMutex.Unlock()

	// Generate ID if not provided
	if digest.ID == "" {
		digest.ID = fmt.Sprintf("digest-%s-%d", userID[:8], time.Now().Unix())
	}

	digest.UserID = userID
	digest.CreatedAt = time.Now()
	digest.UpdatedAt = time.Now()

	// Set defaults
	if digest.Preferences.DeliveryTime == "" {
		digest.Preferences.DeliveryTime = "08:00"
	}
	if digest.Preferences.Timezone == "" {
		digest.Preferences.Timezone = "UTC"
	}

	// Store digest
	app.digests[digest.ID] = digest

	// Add to user's digest list
	if app.userDigests[userID] == nil {
		app.userDigests[userID] = []string{}
	}
	app.userDigests[userID] = append(app.userDigests[userID], digest.ID)

	return &digest, nil
}

// getDigest retrieves a digest by ID
func (app *App) getDigest(digestID string) (*EmailDigest, error) {
	app.digestsMutex.RLock()
	defer app.digestsMutex.RUnlock()

	digest, exists := app.digests[digestID]
	if !exists {
		return nil, fmt.Errorf("digest not found")
	}

	return &digest, nil
}

// getUserDigests retrieves all digests for a user
func (app *App) getUserDigests(userID string) ([]EmailDigest, error) {
	app.digestsMutex.RLock()
	defer app.digestsMutex.RUnlock()

	digestIDs, exists := app.userDigests[userID]
	if !exists {
		return []EmailDigest{}, nil
	}

	digests := make([]EmailDigest, 0, len(digestIDs))
	for _, id := range digestIDs {
		if digest, ok := app.digests[id]; ok {
			digests = append(digests, digest)
		}
	}

	return digests, nil
}

// updateDigest updates an existing digest
func (app *App) updateDigest(digestID string, updates EmailDigest) (*EmailDigest, error) {
	app.digestsMutex.Lock()
	defer app.digestsMutex.Unlock()

	digest, exists := app.digests[digestID]
	if !exists {
		return nil, fmt.Errorf("digest not found")
	}

	// Update fields
	if updates.Name != "" {
		digest.Name = updates.Name
	}
	if updates.Frequency != "" {
		digest.Frequency = updates.Frequency
	}
	if updates.Sources != nil {
		digest.Sources = updates.Sources
	}
	if updates.Rules != nil {
		digest.Rules = updates.Rules
	}
	if updates.Preferences.DeliveryTime != "" {
		digest.Preferences = updates.Preferences
	}
	// Update active status (can be false)
	digest.Active = updates.Active

	digest.UpdatedAt = time.Now()

	app.digests[digestID] = digest
	return &digest, nil
}

// deleteDigest removes a digest
func (app *App) deleteDigest(digestID, userID string) error {
	app.digestsMutex.Lock()
	defer app.digestsMutex.Unlock()

	digest, exists := app.digests[digestID]
	if !exists {
		return fmt.Errorf("digest not found")
	}

	// Verify ownership
	if digest.UserID != userID {
		return fmt.Errorf("unauthorized")
	}

	// Remove from digest map
	delete(app.digests, digestID)

	// Remove from user's digest list
	if digestIDs, ok := app.userDigests[userID]; ok {
		newList := make([]string, 0, len(digestIDs)-1)
		for _, id := range digestIDs {
			if id != digestID {
				newList = append(newList, id)
			}
		}
		app.userDigests[userID] = newList
	}

	return nil
}

// previewDigest executes the searches for a digest and returns preview results
func (app *App) previewDigest(digest EmailDigest) (*DigestPreviewResponse, error) {
	preview := DigestPreviewResponse{
		DigestName: digest.Name,
		Sources:    make([]DigestSourceWithResults, 0, len(digest.Sources)),
		TotalItems: 0,
	}

	// Calculate time filter based on frequency
	timeQuery := getTimeFilterForFrequency(digest.Frequency)

	totalItems := 0
	for _, source := range digest.Sources {
		// Build query with time filter if not already present
		searchQuery := source.Query
		if timeQuery != "" && !containsTimeFilter(searchQuery) {
			searchQuery = searchQuery + " " + timeQuery
		}

		// Execute search for this source
		params := map[string][]string{
			"type": {"pages"},
		}
		results, _ := app.performSearch(searchQuery, params)

		// Limit results based on source's max results (default 10)
		maxResults := source.MaxResults
		if maxResults == 0 {
			maxResults = 10
		}
		if len(results) > maxResults {
			results = results[:maxResults]
		}

		sourceResults := DigestSourceWithResults{
			Name:    source.Name,
			Query:   source.Query,
			Results: results,
		}

		preview.Sources = append(preview.Sources, sourceResults)
		totalItems += len(results)
	}

	preview.TotalItems = totalItems
	return &preview, nil
}

// getTimeFilterForFrequency returns the appropriate time filter based on digest frequency
func getTimeFilterForFrequency(frequency string) string {
	switch frequency {
	case "daily":
		return "since:yesterday"
	case "weekly":
		return "since:last_week"
	case "monthly":
		return "since:last_month"
	default:
		return "since:yesterday"
	}
}

// containsTimeFilter checks if a query already has a time filter
func containsTimeFilter(query string) bool {
	return strings.Contains(query, "since:")
}

// applyRuleToResults applies a single rule to filter results
func (app *App) applyRuleToResults(results []SearchResult, rule DigestRule) []SearchResult {
	if rule.Type == "site_exclude" {
		excludeValue := strings.ToLower(rule.Value)
		filtered := []SearchResult{}
		for _, result := range results {
			url := strings.ToLower(result.URL)
			domain := strings.ToLower(result.BaseDomain)
			// Exclude if URL or domain contains the exclude value
			if !strings.Contains(url, excludeValue) && !strings.Contains(domain, excludeValue) {
				filtered = append(filtered, result)
			}
		}
		return filtered
	} else if rule.Type == "keyword_exclude" {
		excludeKeyword := strings.ToLower(rule.Value)
		filtered := []SearchResult{}
		for _, result := range results {
			title := strings.ToLower(result.Title)
			subtitle := strings.ToLower(result.Subtitle)
			// Exclude if title or subtitle contains the keyword
			if !strings.Contains(title, excludeKeyword) && !strings.Contains(subtitle, excludeKeyword) {
				filtered = append(filtered, result)
			}
		}
		return filtered
	}
	return results
}

// previewSource executes a search for a single source and returns results
func (app *App) previewSource(source DigestSource, frequency string) (*SourcePreviewResponse, error) {
	// Calculate time filter based on frequency
	timeQuery := getTimeFilterForFrequency(frequency)

	// Build query with time filter if not already present
	searchQuery := source.Query
	if timeQuery != "" && !containsTimeFilter(searchQuery) {
		searchQuery = searchQuery + " " + timeQuery
	}

	// Execute search for this source
	params := map[string][]string{
		"type": {"pages"},
	}
	results, _ := app.performSearch(searchQuery, params)

	// Limit results based on source's max results (default 10)
	maxResults := source.MaxResults
	if maxResults == 0 {
		maxResults = 10
	}
	if len(results) > maxResults {
		results = results[:maxResults]
	}

	preview := SourcePreviewResponse{
		SourceName: source.Name,
		Query:      source.Query,
		Results:    results,
		TotalItems: len(results),
	}

	return &preview, nil
}

// getCombinedPreview fetches and combines results from all sources in a digest
func (app *App) getCombinedPreview(digest EmailDigest) (*CombinedPreviewResponse, error) {
	allResults := []SearchResult{}
	bySource := make(map[string]int)
	seenURLs := make(map[string]bool) // For deduplication

	// Calculate time filter based on frequency
	timeQuery := getTimeFilterForFrequency(digest.Frequency)

	for _, source := range digest.Sources {
		// Build query with time filter
		searchQuery := source.Query
		if timeQuery != "" && !containsTimeFilter(searchQuery) {
			searchQuery = searchQuery + " " + timeQuery
		}

		// Execute search
		params := map[string][]string{
			"type": {"pages"},
		}
		results, _ := app.performSearch(searchQuery, params)

		// Limit results
		maxResults := source.MaxResults
		if maxResults == 0 {
			maxResults = 10
		}
		if len(results) > maxResults {
			results = results[:maxResults]
		}

		// Deduplicate and combine
		count := 0
		for _, result := range results {
			if !seenURLs[result.URL] {
				seenURLs[result.URL] = true
				allResults = append(allResults, result)
				count++
			}
		}

		bySource[source.Name] = count
	}

	response := CombinedPreviewResponse{
		Results:    allResults,
		TotalItems: len(allResults),
		BySource:   bySource,
	}

	return &response, nil
}
