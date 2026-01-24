package openai

import (
	"encoding/json"
	"fmt"
	"strings"
)

// NewsletterArticle represents an article to be included in newsletter
type NewsletterArticle struct {
	Title      string `json:"title"`
	URL        string `json:"url"`
	Snippet    string `json:"snippet"`
	Date       string `json:"date"`
	Domain     string `json:"domain"`
	BaseDomain string `json:"basedomain"`
}

const newsletterGenerationSystemPrompt = `You are an expert newsletter writer creating engaging email newsletters from curated content.

Your task: Transform a collection of articles into a well-structured, engaging email newsletter in HTML format.

CRITICAL REQUIREMENTS:
1. **Structure**: Organize content logically with clear sections
2. **Prioritize News**: Time-sensitive/news-like content should appear first
3. **Link Preservation**: Every article title MUST link to the original URL
4. **Summaries**: Write brief, engaging summaries for each article (don't just repeat the snippet)
5. **Grouping**: Group related articles together under themed sections when appropriate
6. **Engaging Style**: Write in a conversational, engaging newsletter tone

HTML FORMAT REQUIREMENTS:
- Use clean, email-safe HTML
- Article titles should be clickable links: <a href="url">Title</a>
- Use sections with clear headers
- Include publication source/domain for context
- Use proper spacing and formatting for readability
- No external CSS - use inline styles
- Keep it simple and professional

CONTENT ORGANIZATION:
- Start with a brief intro (1-2 sentences about what's in this edition)
- Section 1: Breaking news / time-sensitive content
- Section 2+: Thematic groupings of related articles
- End with a brief sign-off

Each article should include:
- Clickable title linking to original URL
- Source/domain
- Brief engaging summary (2-3 sentences)
- Date if relevant

Return ONLY the complete HTML newsletter - no markdown, no explanations, just the HTML.`

// GenerateNewsletter uses OpenAI to generate HTML newsletter from articles
func (c *Client) GenerateNewsletter(articles []NewsletterArticle, digestName string) (string, error) {
	if len(articles) == 0 {
		return "", fmt.Errorf("no articles provided")
	}

	// Build article list for the prompt
	articlesJSON, err := json.MarshalIndent(articles, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal articles: %w", err)
	}

	userPrompt := fmt.Sprintf(`Create an HTML email newsletter for "%s" using these articles:

%s

Remember to:
- Organize with time-sensitive/news content first
- Group related articles into themed sections
- Make all article titles clickable links to their URLs
- Write engaging summaries (don't just copy snippets)
- Use clean HTML with inline styles
- Return ONLY the HTML, no markdown or explanations`, digestName, string(articlesJSON))

	reqBody := request{
		Model: "gpt-5.2", // Use GPT-5.2 for best newsletter generation
		Messages: []message{
			{Role: "system", Content: newsletterGenerationSystemPrompt},
			{Role: "user", Content: userPrompt},
		},
		ReasoningEffort: "medium", // Moderate thinking for balanced quality and speed
		// Note: temperature is not supported when reasoning_effort != "none"
	}

	resp, err := c.callAPI(reqBody)
	if err != nil {
		return "", err
	}

	// Get the HTML content
	htmlContent := resp.Choices[0].Message.Content

	// Strip markdown code blocks if present (e.g., ```html ... ```)
	htmlContent = strings.TrimSpace(htmlContent)
	if strings.HasPrefix(htmlContent, "```html") {
		htmlContent = strings.TrimPrefix(htmlContent, "```html")
		htmlContent = strings.TrimSpace(htmlContent)
	}
	if strings.HasPrefix(htmlContent, "```") {
		htmlContent = strings.TrimPrefix(htmlContent, "```")
		htmlContent = strings.TrimSpace(htmlContent)
	}
	if strings.HasSuffix(htmlContent, "```") {
		htmlContent = strings.TrimSuffix(htmlContent, "```")
		htmlContent = strings.TrimSpace(htmlContent)
	}

	return htmlContent, nil
}
