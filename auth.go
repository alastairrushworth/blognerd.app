package main

import (
	"crypto/rand"
	"encoding/base64"
	"time"
)

// initAuthStore initializes the mock authentication data stores
func (app *App) initAuthStore() {
	app.authMutex.Lock()
	defer app.authMutex.Unlock()

	app.users = make(map[string]User)
	app.sessions = make(map[string]Session)

	// Create a demo user for testing
	demoUser := User{
		ID:        "demo-user-123",
		Email:     "demo@blognerd.app",
		Name:      "Demo User",
		CreatedAt: time.Now(),
	}
	app.users[demoUser.Email] = demoUser
}

// generateToken generates a random session token
func generateToken() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// mockLogin creates a session for a user (mock authentication)
func (app *App) mockLogin(email, password string) (*Session, *User, bool) {
	app.authMutex.Lock()
	defer app.authMutex.Unlock()

	// For demo purposes, accept any email/password combination
	// In production, this would validate against real credentials
	user, exists := app.users[email]
	if !exists {
		// Auto-create user for demo
		user = User{
			ID:        generateToken()[:16],
			Email:     email,
			Name:      email,
			CreatedAt: time.Now(),
		}
		app.users[email] = user
	}

	// Create session
	session := Session{
		Token:     generateToken(),
		UserID:    user.ID,
		ExpiresAt: time.Now().Add(24 * time.Hour),
	}
	app.sessions[session.Token] = session

	return &session, &user, true
}

// validateSession checks if a session token is valid
func (app *App) validateSession(token string) (*User, bool) {
	app.authMutex.RLock()
	defer app.authMutex.RUnlock()

	session, exists := app.sessions[token]
	if !exists {
		return nil, false
	}

	// Check if session is expired
	if time.Now().After(session.ExpiresAt) {
		return nil, false
	}

	// Get user
	for _, user := range app.users {
		if user.ID == session.UserID {
			return &user, true
		}
	}

	return nil, false
}

// logout removes a session
func (app *App) logout(token string) {
	app.authMutex.Lock()
	defer app.authMutex.Unlock()

	delete(app.sessions, token)
}

// cleanupExpiredSessions removes expired sessions (should be called periodically)
func (app *App) cleanupExpiredSessions() {
	app.authMutex.Lock()
	defer app.authMutex.Unlock()

	now := time.Now()
	for token, session := range app.sessions {
		if now.After(session.ExpiresAt) {
			delete(app.sessions, token)
		}
	}
}
