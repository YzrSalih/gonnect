package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/YzrSalih/gonnect/internal/chat"
	"github.com/YzrSalih/gonnect/internal/database"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all connections for development
	},
}

func main() {
	database.InitDB() // Initialize PostgreSQL

	hub := chat.NewHub()
	go hub.Run()

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Gonnect Server is running! Waiting for WebSocket connections...")
	})

	http.HandleFunc("/api/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		if r.Method != "POST" {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Phone    string `json:"phone"`
			Nickname string `json:"nickname"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		user, err := database.LoginOrRegister(req.Phone, req.Nickname)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(user)
	})

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		serveWs(hub, w, r)
	})

	port := ":8080"
	fmt.Printf("Gonnect backend is live on port %s 🚀\n", port)
	
	err := http.ListenAndServe(port, nil)
	if err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}

func serveWs(hub *chat.Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Upgrade Error:", err)
		return
	}
	
	client := &chat.Client{
		Hub:      hub, 
		Conn:     conn, 
		Send:     make(chan []byte, 256),
		ID:       fmt.Sprintf("user_%d", time.Now().UnixNano()),
		Username: "Anonymous",
	}
	
	client.Hub.Register <- client

	// Send recent messages to the newly connected client
	recentMsgs, err := database.GetRecentMessages(50)
	if err == nil {
		for _, dbmsg := range recentMsgs {
			chatMsg := chat.Message{
				Type:       dbmsg.Type,
				SenderID:   dbmsg.SenderID,
				Username:   dbmsg.Username,
				TargetID:   dbmsg.TargetID,
				TargetName: dbmsg.TargetName,
				Content:    dbmsg.Content,
				Timestamp:  dbmsg.Timestamp,
			}
			payload, _ := json.Marshal(chatMsg)
			client.Send <- payload
		}
	} else {
		log.Println("Error fetching recent messages:", err)
	}

	// Start goroutines for reading and writing
	go client.WritePump()
	go client.ReadPump()
}