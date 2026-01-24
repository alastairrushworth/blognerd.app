package main

import (
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"

	"blognerd/internal/clients/openai"
	"blognerd/internal/clients/pinecone"
	"blognerd/internal/clients/voyage"
	"github.com/gorilla/mux"
	"github.com/joho/godotenv"
)

func main() {
	// Load environment variables
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using system environment variables")
	}

	// Initialize clients
	pineconeAPI := pinecone.NewClient(
		os.Getenv("PINECONE_API_KEY"),
		os.Getenv("PINECONE_V2_HOST"),
		os.Getenv("PINECONE_V2_INDEX"),
	)

	voyageAPI := voyage.NewClient(os.Getenv("VOYAGE_API_KEY"))
	openAIAPI := openai.NewClient(os.Getenv("OPENAI_API_KEY"))

	// Load templates
	templates := template.Must(template.ParseGlob("templates/*.html"))

	app := &App{
		templates:   templates,
		pineconeAPI: pineconeAPI,
		voyageAPI:   voyageAPI,
		openAIAPI:   openAIAPI,
		rssCache:    make(map[string]RSSCacheItem),
	}

	// Initialize auth and digest stores
	app.initAuthStore()
	app.initDigestStore()

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

	// Auth routes
	r.HandleFunc("/api/auth/login", app.handleLogin).Methods("POST")
	r.HandleFunc("/api/auth/logout", app.handleLogout).Methods("POST")
	r.HandleFunc("/api/auth/me", app.handleGetCurrentUser).Methods("GET")

	// Email digest routes (protected)
	r.HandleFunc("/api/email-digests", app.authMiddleware(app.handleGetDigests)).Methods("GET")
	r.HandleFunc("/api/email-digests", app.authMiddleware(app.handleCreateDigest)).Methods("POST")
	r.HandleFunc("/api/email-digests/{id}", app.authMiddleware(app.handleGetDigest)).Methods("GET")
	r.HandleFunc("/api/email-digests/{id}", app.authMiddleware(app.handleUpdateDigest)).Methods("PUT")
	r.HandleFunc("/api/email-digests/{id}", app.authMiddleware(app.handleDeleteDigest)).Methods("DELETE")
	r.HandleFunc("/api/email-digests/{id}/preview", app.authMiddleware(app.handlePreviewDigest)).Methods("GET")
	r.HandleFunc("/api/email-digests/{id}/combined-preview", app.authMiddleware(app.handleGetCombinedPreview)).Methods("GET")
	r.HandleFunc("/api/email-digests/preview", app.authMiddleware(app.handlePreviewDigestDraft)).Methods("POST")
	r.HandleFunc("/api/email-digests/preview-source", app.authMiddleware(app.handlePreviewSource)).Methods("POST")
	r.HandleFunc("/api/email-digests/generate-from-description", app.authMiddleware(app.handleGenerateFromDescription)).Methods("POST")
	r.HandleFunc("/api/email-digests/generate-newsletter", app.authMiddleware(app.handleGenerateNewsletter)).Methods("POST")

	// Start server
	port := "8000"
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}

	fmt.Printf("🤓 BlogNerd server starting on http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}