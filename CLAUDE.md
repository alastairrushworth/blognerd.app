# Claude Development Notes

This file contains important context for Claude Code when working on the BlogNerd.app codebase.

## Code Architecture Overview

The codebase has been refactored (September 2024) from a single massive 1,356-line main.go file into focused, maintainable modules.

### Module Structure

**Core Application** (74 lines):
- `main.go` - Minimal bootstrap: environment setup, client initialization, routing only

**Data Layer**:
- `types.go` - All struct definitions and type declarations
- `pinecone.go` - Vector database client and operations  
- `voyage.go` - Embedding generation client

**Business Logic**:
- `search.go` - Core search functionality, query processing, Pinecone integration
- `rss.go` - RSS feed generation with caching (10min cache, 1hr cleanup)
- `export.go` - OPML and CSV export functionality for RSS feeds
- `custom_rss.go` - Advanced RSS workflow builder with drag-drop canvas

**HTTP Layer**:
- `handlers.go` - HTTP request handlers for web pages and JSON API endpoints

**Utilities**:
- `utils.go` - Shared utilities (date parsing, URL cleaning, XML escaping, etc.)

### Key Design Patterns

1. **Dependency Injection**: App struct holds all clients and shared state
2. **Method Receivers**: All handlers and business logic use `(app *App)` receivers
3. **Caching**: RSS feeds cached for 10 minutes, cleaned up after 1 hour
4. **Error Handling**: HTTP errors returned directly, business logic errors logged
5. **Template System**: Go html/template with partials in templates/ directory

### Important Implementation Details

**RSS Builder**: 
- Fixed drag & drop issue by disabling HTML5 drag (`node.draggable = false`) in `templates/scripts.html:711` and `templates/scripts.html:1239`
- Uses custom mouse-based dragging instead of conflicting HTML5 system

**Search System**:
- Combines Pinecone vector search with Voyage AI embeddings
- Supports semantic search, site-specific queries, content type filtering
- Query syntax: `site:domain.com`, `like:url`, `type:blogs`, `since:last_week`

**Export Features**:
- OPML export for RSS readers (requires `type:feeds` in query)
- CSV export for spreadsheet analysis
- Both filter to only include feed results (`result.IsFeed == true`)

### Development Commands

```bash
# Run application
go run .

# Build 
go build -o blognerd-server

# Test build (check compilation)
go build -o test_build && rm test_build
```

### Recent Changes & Bug Fixes

**September 2024**: 
- Major refactoring: broke 1,356-line main.go into focused modules
- Fixed RSS builder drag & drop duplication issue
- All code now compiles and functions correctly

**Template Structure**:
Templates are split into partials for maintainability:
- `index.html` - Main layout that includes other partials
- `head.html` - HTML head section
- `styles.html` - CSS styles  
- `scripts.html` - JavaScript including RSS builder functionality
- `rss-builder.html` - RSS workflow canvas UI
- Other state management partials

### Common Tasks

**Adding New Features**:
1. Add types to `types.go` if needed
2. Add business logic to appropriate module (`search.go`, `rss.go`, etc.)  
3. Add HTTP handlers to `handlers.go`
4. Update routing in `main.go`
5. Add templates/styles as needed

**Debugging Issues**:
- Check logs for business logic errors (logged but don't stop execution)
- HTTP errors return immediately with proper status codes
- RSS cache issues: check 10min cache timeout and 1hr cleanup

### File Size Context
- Original main.go: 1,356 lines (massive, unmaintainable)
- Refactored main.go: 74 lines (focused on bootstrap only)
- Total codebase is well-organized across ~10 focused files

This architecture makes the code much easier to understand, modify, and maintain.