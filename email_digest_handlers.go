package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"blognerd/internal/clients/openai"
	"github.com/gorilla/mux"
)

// getSessionToken extracts the session token from the request
func getSessionToken(r *http.Request) string {
	// Check Authorization header first
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		// Format: "Bearer <token>"
		parts := strings.Split(authHeader, " ")
		if len(parts) == 2 && parts[0] == "Bearer" {
			return parts[1]
		}
	}

	// Check cookie as fallback
	cookie, err := r.Cookie("session_token")
	if err == nil {
		return cookie.Value
	}

	return ""
}

// authMiddleware validates the session token
func (app *App) authMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// TEMPORARY: Skip auth for testing
		r.Header.Set("X-User-ID", "test-user")
		r.Header.Set("X-User-Email", "test@example.com")
		next(w, r)

		/* Original auth code - restore this later
		token := getSessionToken(r)
		if token == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}

		user, valid := app.validateSession(token)
		if !valid {
			http.Error(w, "Invalid or expired session", http.StatusUnauthorized)
			return
		}

		// Store user in request context for use in handlers
		r.Header.Set("X-User-ID", user.ID)
		r.Header.Set("X-User-Email", user.Email)

		next(w, r)
		*/
	}
}

// handleLogin handles user login (mock)
func (app *App) handleLogin(w http.ResponseWriter, r *http.Request) {
	var loginReq struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	if err := json.NewDecoder(r.Body).Decode(&loginReq); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	session, user, ok := app.mockLogin(loginReq.Email, loginReq.Password)
	if !ok {
		http.Error(w, "Invalid credentials", http.StatusUnauthorized)
		return
	}

	// Set cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    session.Token,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // Set to true in production with HTTPS
		SameSite: http.SameSiteLaxMode,
		MaxAge:   86400, // 24 hours
	})

	response := map[string]interface{}{
		"user":  user,
		"token": session.Token,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// handleLogout handles user logout
func (app *App) handleLogout(w http.ResponseWriter, r *http.Request) {
	token := getSessionToken(r)
	if token != "" {
		app.logout(token)
	}

	// Clear cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "logged out"})
}

// handleGetCurrentUser returns the current authenticated user
func (app *App) handleGetCurrentUser(w http.ResponseWriter, r *http.Request) {
	token := getSessionToken(r)
	if token == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	user, valid := app.validateSession(token)
	if !valid {
		http.Error(w, "Invalid or expired session", http.StatusUnauthorized)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// handleGetDigests returns all digests for the authenticated user
func (app *App) handleGetDigests(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")

	digests, err := app.getUserDigests(userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(digests)
}

// handleCreateDigest creates a new email digest
func (app *App) handleCreateDigest(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")

	var digest EmailDigest
	if err := json.NewDecoder(r.Body).Decode(&digest); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	created, err := app.createDigest(userID, digest)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(created)
}

// handleGetDigest returns a specific digest
func (app *App) handleGetDigest(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	vars := mux.Vars(r)
	digestID := vars["id"]

	digest, err := app.getDigest(digestID)
	if err != nil {
		http.Error(w, "Digest not found", http.StatusNotFound)
		return
	}

	// Verify ownership
	if digest.UserID != userID {
		http.Error(w, "Unauthorized", http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(digest)
}

// handleUpdateDigest updates an existing digest
func (app *App) handleUpdateDigest(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	vars := mux.Vars(r)
	digestID := vars["id"]

	// Verify ownership
	existing, err := app.getDigest(digestID)
	if err != nil {
		http.Error(w, "Digest not found", http.StatusNotFound)
		return
	}
	if existing.UserID != userID {
		http.Error(w, "Unauthorized", http.StatusForbidden)
		return
	}

	var updates EmailDigest
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	updated, err := app.updateDigest(digestID, updates)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

// handleDeleteDigest deletes a digest
func (app *App) handleDeleteDigest(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	vars := mux.Vars(r)
	digestID := vars["id"]

	err := app.deleteDigest(digestID, userID)
	if err != nil {
		if err.Error() == "unauthorized" {
			http.Error(w, err.Error(), http.StatusForbidden)
		} else {
			http.Error(w, err.Error(), http.StatusNotFound)
		}
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "deleted"})
}

// handlePreviewDigest generates a preview of digest content
func (app *App) handlePreviewDigest(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	vars := mux.Vars(r)
	digestID := vars["id"]

	digest, err := app.getDigest(digestID)
	if err != nil {
		http.Error(w, "Digest not found", http.StatusNotFound)
		return
	}

	// Verify ownership
	if digest.UserID != userID {
		http.Error(w, "Unauthorized", http.StatusForbidden)
		return
	}

	preview, err := app.previewDigest(*digest)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(preview)
}

// handlePreviewDigestDraft generates a preview without saving
func (app *App) handlePreviewDigestDraft(w http.ResponseWriter, r *http.Request) {
	var digest EmailDigest
	if err := json.NewDecoder(r.Body).Decode(&digest); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	preview, err := app.previewDigest(digest)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(preview)
}

// handlePreviewSource generates a preview for a single source
func (app *App) handlePreviewSource(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Source    DigestSource `json:"source"`
		Frequency string       `json:"frequency"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	preview, err := app.previewSource(req.Source, req.Frequency)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(preview)
}

// handleGetCombinedPreview generates combined preview from all sources
func (app *App) handleGetCombinedPreview(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	vars := mux.Vars(r)
	digestID := vars["id"]

	digest, err := app.getDigest(digestID)
	if err != nil {
		http.Error(w, "Digest not found", http.StatusNotFound)
		return
	}

	// Verify ownership
	if digest.UserID != userID {
		http.Error(w, "Unauthorized", http.StatusForbidden)
		return
	}

	preview, err := app.getCombinedPreview(*digest)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(preview)
}

// handleGenerateFromDescription uses AI to generate digest configuration
func (app *App) handleGenerateFromDescription(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Description string `json:"description"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Description == "" {
		http.Error(w, "Description is required", http.StatusBadRequest)
		return
	}

	result, err := app.openAIAPI.GenerateDigestFromDescription(req.Description)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// handleGenerateNewsletter generates HTML newsletter from digest configuration
func (app *App) handleGenerateNewsletter(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name      string         `json:"name"`
		Frequency string         `json:"frequency"`
		Sources   []DigestSource `json:"sources"`
		Rules     []DigestRule   `json:"rules"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if len(req.Sources) == 0 {
		http.Error(w, "At least one source is required", http.StatusBadRequest)
		return
	}

	// Create a temporary digest to get combined preview
	tempDigest := EmailDigest{
		Name:      req.Name,
		Frequency: req.Frequency,
		Sources:   req.Sources,
		Rules:     req.Rules,
	}

	// Get combined and filtered results
	preview, err := app.getCombinedPreview(tempDigest)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Apply rules to filter results (same as frontend does)
	filteredResults := preview.Results
	for _, rule := range req.Rules {
		filteredResults = app.applyRuleToResults(filteredResults, rule)
	}

	if len(filteredResults) == 0 {
		http.Error(w, "No articles remaining after filtering", http.StatusBadRequest)
		return
	}

	// Convert to NewsletterArticle format
	articles := make([]openai.NewsletterArticle, len(filteredResults))
	for i, result := range filteredResults {
		articles[i] = openai.NewsletterArticle{
			Title:      result.Title,
			URL:        result.URL,
			Snippet:    result.Subtitle,
			Date:       result.Date,
			Domain:     result.OriginalDomain,
			BaseDomain: result.BaseDomain,
		}
	}

	// Generate newsletter HTML using OpenAI
	newsletterHTML, err := app.openAIAPI.GenerateNewsletter(articles, req.Name)
	if err != nil {
		log.Printf("Newsletter generation error: %v", err)
		http.Error(w, fmt.Sprintf("Newsletter generation failed: %v", err), http.StatusInternalServerError)
		return
	}

	// Return the HTML
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"html": newsletterHTML,
	})
}
