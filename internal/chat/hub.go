package chat

import (
	"encoding/json"
	"time"
)

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	Clients    map[*Client]bool
	Broadcast  chan []byte
	Register   chan *Client
	Unregister chan *Client
}

func NewHub() *Hub {
	return &Hub{
		Broadcast:  make(chan []byte),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Clients:    make(map[*Client]bool),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.Clients[client] = true
			
			// Broadcast join message
			msg := Message{
				Type:      "system",
				SenderID:  "system",
				Username:  "System",
				Content:   client.Username + " joined the server.",
				Timestamp: time.Now(),
			}
			payload, _ := json.Marshal(msg)
			h.broadcastPayload(payload)

		case client := <-h.Unregister:
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				close(client.Send)
				
				// Broadcast leave message
				msg := Message{
					Type:      "system",
					SenderID:  "system",
					Username:  "System",
					Content:   client.Username + " left the server.",
					Timestamp: time.Now(),
				}
				payload, _ := json.Marshal(msg)
				h.broadcastPayload(payload)
			}
		case message := <-h.Broadcast:
			h.broadcastPayload(message)
		}
	}
}

func (h *Hub) broadcastPayload(payload []byte) {
	for client := range h.Clients {
		select {
		case client.Send <- payload:
		default:
			close(client.Send)
			delete(h.Clients, client)
		}
	}
}