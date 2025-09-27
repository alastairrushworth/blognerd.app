package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type VoyageClient struct {
	apiKey string
	client *http.Client
}

type VoyageEmbeddingRequest struct {
	Input     []string `json:"input"`
	Model     string   `json:"model"`
	InputType string   `json:"input_type,omitempty"`
}

type VoyageEmbeddingResponse struct {
	Data []struct {
		Embedding []float64 `json:"embedding"`
		Index     int       `json:"index"`
	} `json:"data"`
	Model string `json:"model"`
	Usage struct {
		TotalTokens int `json:"total_tokens"`
	} `json:"usage"`
}

func NewVoyageClient(apiKey string) *VoyageClient {
	return &VoyageClient{
		apiKey: apiKey,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (vc *VoyageClient) GetEmbedding(text string) ([]float64, error) {
	return vc.GetEmbeddingWithType(text, "query")
}

func (vc *VoyageClient) GetEmbeddingWithType(text string, inputType string) ([]float64, error) {
	if text == "" {
		return nil, fmt.Errorf("text cannot be empty")
	}

	// Build request
	reqBody := VoyageEmbeddingRequest{
		Input:     []string{text},
		Model:     "voyage-3-large",
		InputType: inputType,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Make HTTP request
	url := "https://api.voyageai.com/v1/embeddings"
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+vc.apiKey)

	resp, err := vc.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("voyage API error %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var response VoyageEmbeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(response.Data) == 0 {
		return nil, fmt.Errorf("no embedding returned")
	}

	return response.Data[0].Embedding, nil
}

func (vc *VoyageClient) GetEmbeddings(texts []string, inputType string) ([][]float64, error) {
	if len(texts) == 0 {
		return nil, fmt.Errorf("texts cannot be empty")
	}

	// Build request
	reqBody := VoyageEmbeddingRequest{
		Input:     texts,
		Model:     "voyage-3-large",
		InputType: inputType,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Make HTTP request
	url := "https://api.voyageai.com/v1/embeddings"
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+vc.apiKey)

	resp, err := vc.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("voyage API error %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var response VoyageEmbeddingResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if len(response.Data) != len(texts) {
		return nil, fmt.Errorf("expected %d embeddings, got %d", len(texts), len(response.Data))
	}

	// Extract embeddings in order
	embeddings := make([][]float64, len(texts))
	for _, data := range response.Data {
		if data.Index >= len(texts) {
			return nil, fmt.Errorf("invalid index %d in response", data.Index)
		}
		embeddings[data.Index] = data.Embedding
	}

	return embeddings, nil
}