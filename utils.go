package main

import (
	"encoding/base64"
	"sort"
	"strings"
	"time"
)

// getParam extracts a parameter value from URL query parameters
func getParam(params map[string][]string, key string) string {
	if values, ok := params[key]; ok && len(values) > 0 {
		return values[0]
	}
	return ""
}

// getStringDefault returns defaultValue if value is empty
func getStringDefault(value, defaultValue string) string {
	if value == "" {
		return defaultValue
	}
	return value
}

// getMetadataString safely extracts a string value from metadata map
func getMetadataString(metadata map[string]interface{}, key string) string {
	if val, ok := metadata[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

// getMetadataKeys returns all keys from a metadata map
func getMetadataKeys(metadata map[string]interface{}) []string {
	keys := make([]string, 0, len(metadata))
	for key := range metadata {
		keys = append(keys, key)
	}
	return keys
}

// cleanURL removes protocol, www prefix, and trailing slash from URL
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

// formatDate converts various date formats to YYYY-MM-DD format
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

// parseTimeFromMetadata extracts and parses date from metadata
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

// escapeXML escapes special characters for XML
func escapeXML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	return s
}

// base64DecodeString decodes a base64 string
func base64DecodeString(encoded string) (string, error) {
	decoded, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	return string(decoded), nil
}

// sortResultsByTime sorts search results by publication date (most recent first)
func sortResultsByTime(results []SearchResult) {
	sort.Slice(results, func(i, j int) bool {
		dateI := parseDate(results[i].Date)
		dateJ := parseDate(results[j].Date)
		return dateI.After(dateJ) // Most recent first
	})
}

// deduplicateByTitle removes duplicate search results based on title
func deduplicateByTitle(results []SearchResult) []SearchResult {
	seen := make(map[string]bool)
	deduped := make([]SearchResult, 0, len(results))

	for _, result := range results {
		// Use lowercase title for comparison to handle case variations
		titleKey := strings.ToLower(strings.TrimSpace(result.Title))

		if !seen[titleKey] {
			seen[titleKey] = true
			deduped = append(deduped, result)
		}
	}

	return deduped
}