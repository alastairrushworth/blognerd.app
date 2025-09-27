from fastapi import FastAPI, Request, Form, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from typing import Optional, List
import time

from blognerd.search import run_search
from blognerd.pc import search_pc

app = FastAPI(title="BlogNerd - Blog Search Engine")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
async def home(
    request: Request,
    qry: Optional[str] = Query(None),
    type: Optional[str] = Query("pages"),
    content: Optional[str] = Query(None),
    time_filter: Optional[str] = Query(None)
):
    return templates.TemplateResponse("index.html", {
        "request": request,
        "query": qry or "",
        "search_type": type,
        "search_content": content,
        "search_time": time_filter,
        "results": None,
        "time_taken": 0,
        "total_results": 0
    })

@app.get("/search", response_class=HTMLResponse)
async def search_page(
    request: Request,
    qry: str = Query(...),
    type: str = Query("pages"),
    content: Optional[str] = Query(None),
    time_filter: Optional[str] = Query(None)
):
    # Build search query with filters
    search_query = qry
    
    if type == "sites":
        search_query += ' type:feeds'
    else:
        if content:
            search_query += f' type:{content}'
        if time_filter:
            search_query += f' since:last_{time_filter}'
    
    # Perform search
    start_time = time.time()
    results, _ = search_pc(search_query, nmax=50)
    search_time = time.time() - start_time
    
    # Process results for display
    results_list = []
    if len(results) > 0:
        is_feed_search = "type:feeds" in search_query
        results_list = results.to_dict('records')
        
        # Add button data to each result
        for result in results_list:
            result['is_feed_search'] = is_feed_search
            result['timestamp'] = str(int(time.time()))
    
    return templates.TemplateResponse("index.html", {
        "request": request,
        "query": qry,
        "search_type": type,
        "search_content": content,
        "search_time": time_filter,
        "results": results_list,
        "time_taken": search_time,
        "total_results": len(results_list)
    })

@app.api_route("/api/search", methods=["GET", "POST"])
async def api_search(
    qry: str = Query(...),
    type: str = Query("pages"),
    content: Optional[str] = Query(None),
    time_filter: Optional[str] = Query(None)
):
    # Build search query with filters
    search_query = qry
    
    if type == "sites":
        search_query += ' type:feeds'
    else:
        if content:
            search_query += f' type:{content}'
        if time_filter:
            search_query += f' since:last_{time_filter}'
    
    # Perform search
    start_time = time.time()
    results, _ = search_pc(search_query, nmax=50)
    search_time = time.time() - start_time
    
    # Process results for JSON response
    results_list = []
    if len(results) > 0:
        is_feed_search = "type:feeds" in search_query
        results_list = results.to_dict('records')
        
        # Clean up results for JSON
        for result in results_list:
            result['is_feed_search'] = is_feed_search
            # Convert any numpy types to native Python types
            for key, value in result.items():
                if hasattr(value, 'item'):
                    result[key] = value.item()
    
    return JSONResponse({
        "results": results_list,
        "time_taken": round(search_time, 2),
        "total_results": len(results_list)
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)