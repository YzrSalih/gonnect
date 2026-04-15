package chat

import (
	"encoding/json"
	"log"
	"time"

	"github.com/YzrSalih/gonnect/internal/database"
	"github.com/gorilla/websocket"
)

// Client is a middleman between the websocket connection and the hub.
type Client struct {
	Hub      *Hub
	Conn     *websocket.Conn
	Send     chan []byte
	ID       string
	Username string
}

// ReadPump transfers messages from the websocket connection to the hub.
func (c *Client) ReadPump() {
	defer func() {
		c.Hub.Unregister <- c
		c.Conn.Close()
	}()

	for {
		_, payload, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		
		// Parse incoming JSON
		var msg Message
		err = json.Unmarshal(payload, &msg)
		if err != nil {
			log.Println("Invalid JSON received:", string(payload))
			continue
		}

		// Enrich the message
		if msg.SenderID != "" {
			c.ID = msg.SenderID
		} else {
			msg.SenderID = c.ID
		}
		
		if msg.Username == "" {
			msg.Username = c.Username
		} else {
			// Update username if they changed it
			c.Username = msg.Username
		}
		if msg.Type == "" {
			msg.Type = "chat"
		}
		msg.Timestamp = time.Now()

		// Save to the Database
		err = database.SaveMessage(msg.Type, msg.SenderID, msg.Username, msg.TargetID, msg.Content, msg.Timestamp)
		if err != nil {
			log.Println("Database error:", err)
		}

		// Marshal back to JSON
		enrichedPayload, err := json.Marshal(msg)
		if err != nil {
			log.Println("Error marshaling message:", err)
			continue
		}

		// Broadcast the structured message to everyone
		c.Hub.Broadcast <- enrichedPayload
	}
}

// WritePump transfers messages from the hub to the websocket connection.
func (c *Client) WritePump() {
	defer func() {
		c.Conn.Close()
	}()
	for {
		message, ok := <-c.Send
		if !ok {
			// The hub closed the channel.
			c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
			return
		}

		w, err := c.Conn.NextWriter(websocket.TextMessage)
		if err != nil {
			return
		}
		w.Write(message)

		if err := w.Close(); err != nil {
			return
		}
	}
}