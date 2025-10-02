package main

import (
	"fmt"
	"html/template"
	"log"
	"net/http"
	"os"

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
	pineconeAPI := NewPineconeClient(
		os.Getenv("PINECONE_API_KEY"),
		os.Getenv("PINECONE_V2_HOST"),
		os.Getenv("PINECONE_V2_INDEX"),
	)

	voyageAPI := NewVoyageClient(os.Getenv("VOYAGE_API_KEY"))

	// Load templates
	templates := template.Must(template.ParseGlob("templates/*.html"))

	app := &App{
		templates:   templates,
		pineconeAPI: pineconeAPI,
		voyageAPI:   voyageAPI,
		rssCache:    make(map[string]RSSCacheItem),
	}

	// Setup routes
	r := mux.NewRouter()
	
	// Static files
	r.PathPrefix("/static/").Handler(http.StripPrefix("/static/", http.FileServer(http.Dir("static/"))))
	
	// Routes
	r.HandleFunc("/", app.handleHome).Methods("GET")
	r.HandleFunc("/search", app.handleSearch).Methods("GET")
	r.HandleFunc("/custom-rss", app.handleCustomRSSPage).Methods("GET")
	r.HandleFunc("/api/search", app.handleAPISearch).Methods("GET", "POST")
	r.HandleFunc("/api/export/opml", app.handleOPMLExport).Methods("GET", "POST")
	r.HandleFunc("/api/export/csv", app.handleCSVExport).Methods("GET", "POST")
	r.HandleFunc("/rss", app.handleRSSFeed).Methods("GET")
	r.HandleFunc("/api/custom-rss", app.handleCustomRSSFeed).Methods("GET")
	r.HandleFunc("/api/custom-rss/generate", app.handleCustomRSSPost).Methods("POST")

	// Start server
	port := "8000"
	if p := os.Getenv("PORT"); p != "" {
		port = p
	}

	fmt.Printf("🤓 BlogNerd server starting on http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}