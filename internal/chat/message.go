package chat

import "time"

// Message represents a structured JSON payload for WebSocket communication.
type Message struct {
	Type      string    `json:"type"`      // e.g., "chat", "system"
	SenderID  string    `json:"senderId"`
	Username  string    `json:"username"`
	TargetID  string    `json:"targetId,omitempty"`
	TargetName string   `json:"targetName,omitempty"`
	Content   string    `json:"content"`
	Timestamp time.Time `json:"timestamp"`
}
