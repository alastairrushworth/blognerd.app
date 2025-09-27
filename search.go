package main

import (
	"regexp"
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