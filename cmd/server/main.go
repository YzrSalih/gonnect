package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/YzrSalih/gonnect/internal/chat"
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
	hub := chat.NewHub()
	go hub.Run()

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		fmt.Fprintf(w, "Gonnect Server is running! Waiting for WebSocket connections...")
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
		Hub:  hub, 
		Conn: conn, 
		Send: make(chan []byte, 256),
	}
	
	client.Hub.Register <- client

	// Start goroutines for reading and writing
	go client.WritePump()
	go client.ReadPump()
}