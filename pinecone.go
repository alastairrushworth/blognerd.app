package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type PineconeClient struct {
	apiKey string
	host   string
	index  string
	client *http.Client
}

type PineconeMatch struct {
	ID       string                 `json:"id"`
	Score    float64               `json:"score"`
	Metadata map[string]interface{} `json:"metadata"`
	Values   []float64             `json:"values"`
}

type PineconeQueryResponse struct {
	Matches []PineconeMatch `json:"matches"`
}

type PineconeQueryRequest struct {
	Vector          []float64              `json:"vector"`
	TopK            int                    `json:"topK"`
	IncludeMetadata bool                   `json:"includeMetadata"`
	IncludeValues   bool                   `json:"includeValues"`
	Namespace       string                 `json:"namespace"`
	Filter          map[string]interface{} `json:"filter,omitempty"`
}

type PineconeFetchResponse struct {
	Vectors map[string]struct {
		ID       string                 `json:"id"`
		Values   []float64             `json:"values"`
		Metadata map[string]interface{} `json:"metadata"`
	} `json:"vectors"`
}

func NewPineconeClient(apiKey, host, index string) *PineconeClient {
	return &PineconeClient{
		apiKey: apiKey,
		host:   host,
		index:  index,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (pc *PineconeClient) Query(namespace string, embedding []float64, filters map[string]interface{}, topK int) ([]PineconeMatch, error) {
	if len(embedding) == 0 {
		return []PineconeMatch{}, nil
	}

	// Build request
	reqBody := PineconeQueryRequest{
		Vector:          embedding,
		TopK:            topK,
		IncludeMetadata: true,
		IncludeValues:   false,
		Namespace:       namespace,
		Filter:          filters,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	
	// Debug: Log the exact JSON being sent to Pinecone
	if len(filters) > 0 {
		fmt.Printf("DEBUG PINECONE JSON: %s\n", string(jsonData))
	}

	// Make HTTP request
	url := fmt.Sprintf("%s/query", pc.host)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Api-Key", pc.apiKey)

	resp, err := pc.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pinecone API error %d: %s", resp.StatusCode, string(body))
	}

	// Parse response
	var response PineconeQueryResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return response.Matches, nil
}

func (pc *PineconeClient) GetEmbedding(id string) ([]float64, error) {
	// Fetch vector from Pinecone by ID using default namespace
	return pc.GetEmbeddingFromNamespace(id, pc.index)
}

func (pc *PineconeClient) GetEmbeddingFromNamespace(id string, namespace string) ([]float64, error) {
	// Fetch vector from Pinecone by ID from specific namespace
	url := fmt.Sprintf("%s/vectors/fetch?ids=%s&namespace=%s", pc.host, id, namespace)
	
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Api-Key", pc.apiKey)

	resp, err := pc.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("pinecone fetch error %d: %s", resp.StatusCode, string(body))
	}

	var response PineconeFetchResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if vector, exists := response.Vectors[id]; exists {
		return vector.Values, nil
	}

	return nil, fmt.Errorf("vector not found for ID: %s", id)
}