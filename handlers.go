package main

import (
	"encoding/json"
	"net/http"
)

// handleHome renders the homepage with search form
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

// handleSearch handles the main search functionality with HTML response
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

// handleAPISearch handles search requests with JSON response
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