package utils

import (
	"encoding/base64"
	"strings"
	"time"
)

// GetParam extracts a parameter value from URL query parameters
func GetParam(params map[string][]string, key string) string {
	if values, ok := params[key]; ok && len(values) > 0 {
		return values[0]
	}
	return ""
}

// GetStringDefault returns defaultValue if value is empty
func GetStringDefault(value, defaultValue string) string {
	if value == "" {
		return defaultValue
	}
	return value
}

// GetMetadataString safely extracts a string value from metadata map
func GetMetadataString(metadata map[string]interface{}, key string) string {
	if val, ok := metadata[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return ""
}

// CleanURL removes protocol, www prefix, and trailing slash from URL
func CleanURL(url string) string {
	// Remove http:// and https:// schemes
	url = strings.TrimPrefix(url, "https://")
	url = strings.TrimPrefix(url, "http://")
	
	// Remove www. prefix
	url = strings.TrimPrefix(url, "www.")
	
	// Remove trailing slash
	url = strings.TrimSuffix(url, "/")
	
	return url
}

// FormatDate converts various date formats to YYYY-MM-DD format
func FormatDate(dateStr string) string {
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

// ParseDate parses various date formats and returns a time.Time
func ParseDate(dateStr string) time.Time {
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

// EscapeXML escapes special characters for XML
func EscapeXML(s string) string {
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