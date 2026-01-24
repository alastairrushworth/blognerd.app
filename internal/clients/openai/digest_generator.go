package openai

import (
	"encoding/json"
	"fmt"
)

// DigestGenerationResult is the structured output from AI
type DigestGenerationResult struct {
	Name      string              `json:"name"`
	Frequency string              `json:"frequency"`
	Sources   []DigestSourceQuery `json:"sources"`
}

// DigestSourceQuery represents a search query for a digest source
type DigestSourceQuery struct {
	Query string `json:"query"`
}

const digestGenerationSystemPrompt = `You are helping users create email digest configurations for BlogNerd, a semantic search engine for blogs and RSS feeds.

BlogNerd uses semantic search to find relevant content based on keywords and concepts. Users can filter by type:blogs, type:feeds, type:academic, or type:pages if needed.

Your task: Given a user's description of content they want, generate a digest configuration with:
1. A clear, concise name (2-5 words)
2. Frequency (daily, weekly, or monthly) - choose based on content volume and user needs
3. Exactly 5 distinct search queries that provide comprehensive coverage through specific sub-areas

CRITICAL REQUIREMENTS for search queries:
- DO NOT use site: filters (avoid site-specific queries)
- Each query should target a SPECIFIC sub-area or sub-topic
- Queries must be DISTINCT with minimal overlap
- Together, the 5 queries should provide BROAD COVERAGE of the user's interest
- Avoid generic terms that would return similar content
- Use semantic search terms focusing on concepts, not just keywords

Example - BAD (generic, overlapping):
- "machine learning"
- "AI and machine learning"
- "artificial intelligence research"
- "machine learning algorithms"
- "ML and deep learning"

Example - GOOD (specific sub-areas, distinct coverage):
- "reinforcement learning policy gradients"
- "computer vision transformer architectures"
- "natural language processing large language models"
- "graph neural networks knowledge graphs"
- "time series forecasting deep learning"

Think of the user's interest as a broad area. Your job is to identify 5 specific, distinct sub-topics within that area that together provide comprehensive coverage without significant overlap.

Return ONLY valid JSON in this exact format:
{
  "name": "digest name",
  "frequency": "daily",
  "sources": [
    {"query": "specific sub-topic 1"},
    {"query": "specific sub-topic 2"},
    {"query": "specific sub-topic 3"},
    {"query": "specific sub-topic 4"},
    {"query": "specific sub-topic 5"}
  ]
}

Do not include any markdown, explanation, or additional text - only the JSON object.`

// GenerateDigestFromDescription uses OpenAI to generate digest configuration
func (c *Client) GenerateDigestFromDescription(description string) (*DigestGenerationResult, error) {
	reqBody := request{
		Model: "gpt-4o-mini", // Fast and cost-effective
		Messages: []message{
			{Role: "system", Content: digestGenerationSystemPrompt},
			{Role: "user", Content: description},
		},
		Temperature: 0.7,
	}

	resp, err := c.callAPI(reqBody)
	if err != nil {
		return nil, err
	}

	// Parse the JSON content from the AI response
	var result DigestGenerationResult
	content := resp.Choices[0].Message.Content
	if err := json.Unmarshal([]byte(content), &result); err != nil {
		return nil, fmt.Errorf("failed to parse AI response as JSON: %w (content: %s)", err, content)
	}

	return &result, nil
}
