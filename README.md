# BlogNerd.app

A semantic search engine for blog posts and RSS feeds, powered by vector embeddings and AI.

## Features

- 🔍 **Semantic Search**: Find blog posts and RSS feeds using natural language queries
- 📱 **Mobile Responsive**: Optimized for all screen sizes
- 🏷️ **Content Filtering**: Filter by content type (blogs, academic, news) and time periods
- 🔗 **RSS Feed Discovery**: Search and discover RSS feeds with export functionality
- 📊 **Export Options**: Export RSS feeds as OPML or CSV files
- ⚡ **Fast Search**: Powered by Pinecone vector database and Voyage AI embeddings

## Technology Stack

- **Backend**: Go 1.21 with Gorilla Mux router
- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **Vector Database**: Pinecone
- **Embeddings**: Voyage AI
- **Deployment**: Docker support included

## Prerequisites

- Go 1.21 or later
- Pinecone account and API key
- Voyage AI account and API key

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/alastairrushworth/blognerd.app.git
   cd blognerd.app
   ```

2. **Install Go dependencies**
   ```bash
   go mod download
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add your API keys:
   ```
   PINECONE_API_KEY=your-pinecone-api-key
   PINECONE_V2_ENVIRONMENT=your-pinecone-environment
   PINECONE_V2_INDEX=your-pinecone-index-name
   PINECONE_V2_HOST=your-pinecone-host-url
   VOYAGE_API_KEY=your-voyage-ai-api-key
   ```

4. **Run the application**
   ```bash
   go run .
   ```
   
   Or build and run:
   ```bash
   go build -o blognerd-server
   ./blognerd-server
   ```

5. **Open in browser**
   ```
   http://localhost:8000
   ```

## Docker Deployment

Build and run with Docker:

```bash
docker build -t blognerd-app .
docker run -p 8000:8000 --env-file .env blognerd-app
```

## API Endpoints

### Search API
- `GET /api/search?qry=<query>&type=<pages|sites>&content=<content_type>&time=<time_filter>`
- Returns JSON with search results

### Export APIs
- `GET /api/export/opml?qry=<query>&type=sites` - Export RSS feeds as OPML
- `GET /api/export/csv?qry=<query>&type=sites` - Export RSS feeds as CSV

## Search Syntax

### Basic Search
```
ai machine learning
```

### Site-specific Search
```
site:openai.com
```

### Similar Posts/Blogs
```
like:https://example.com/blog-post
like:example.com
```

### Content Type Filters
- `type:blogs` - Blog posts only
- `type:academic` - Academic papers
- `type:news` - News articles
- `type:feeds` - RSS feeds only

### Time Filters
- `since:last_week` - Past week
- `since:last_month` - Past month
- `since:last_year` - Past year

## Project Structure

The codebase is organized into focused modules for maintainability:

```
blognerd.app/
├── main.go           # Application bootstrap and routing (74 lines)
├── types.go          # Data structures and type definitions
├── handlers.go       # HTTP request handlers (home, search, API)
├── search.go         # Search functionality and query processing
├── rss.go            # RSS feed generation and caching
├── export.go         # OPML and CSV export functionality
├── custom_rss.go     # Custom RSS workflow processing
├── utils.go          # Utility functions (parsing, formatting, etc.)
├── pinecone.go       # Pinecone vector database client
├── voyage.go         # Voyage AI embeddings client
├── templates/        # HTML templates
│   ├── index.html
│   ├── head.html
│   ├── styles.html
│   ├── scripts.html
│   ├── rss-builder.html
│   ├── search-state.html
│   ├── initial-state.html
│   └── footer.html
├── static/           # Static assets (CSS, images)
├── .env.example      # Environment variables template
├── Dockerfile        # Docker configuration
├── go.mod           # Go module definition
└── README.md        # This file
```

### Module Responsibilities

- **`main.go`**: Minimal bootstrap code - initializes clients, templates, routes
- **`types.go`**: All struct definitions (SearchResult, App, CustomRSSConfig, etc.)
- **`handlers.go`**: HTTP handlers for web pages and API endpoints
- **`search.go`**: Core search logic, Pinecone queries, result processing
- **`rss.go`**: RSS feed generation with caching and cleanup
- **`export.go`**: OPML and CSV export for RSS feeds
- **`custom_rss.go`**: Advanced RSS workflow builder functionality
- **`utils.go`**: Shared utilities for date parsing, URL cleaning, XML escaping
- **`pinecone.go`**: Vector database client and operations
- **`voyage.go`**: Embedding generation client

## Development

### Adding New Features

1. **Backend changes**: Modify the appropriate Go files
2. **Frontend changes**: Edit `templates/index.html`
3. **Static assets**: Add to `static/` directory

### Code Style

- Follow standard Go conventions
- Use `gofmt` for formatting
- Add comments for public functions
- Keep functions focused and small

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit with descriptive messages: `git commit -m "Add feature description"`
5. Push to your fork: `git push origin feature-name`
6. Create a pull request

## License

This project is open source. See the repository for license details.

## Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for similar problems

## Acknowledgments

- Powered by [Pinecone](https://pinecone.io/) vector database
- Embeddings by [Voyage AI](https://www.voyageai.com/)
- Built with [Go](https://golang.org/) and [Gorilla Mux](https://github.com/gorilla/mux)