package database

import (
	"database/sql"
	"log"
	"time"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func InitDB() {
	var err error
	// PostgreSQL connection string
	connStr := "postgres://gonnect_user:gonnect_password@localhost:5432/gonnect_db?sslmode=disable"
	
	DB, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	if err = DB.Ping(); err != nil {
		log.Fatal("Database unreachable. Is PostgreSQL running?", err)
	}

	createTables()
	log.Println("Database connected successfully!")
}

func createTables() {
	query := `
	CREATE TABLE IF NOT EXISTS messages (
		id SERIAL PRIMARY KEY,
		type VARCHAR(50),
		sender_id VARCHAR(100),
		username VARCHAR(100),
		content TEXT,
		timestamp TIMESTAMP
	);`
	_, err := DB.Exec(query)
	if err != nil {
		log.Fatal("Failed to create tables:", err)
	}
}

// SaveMessage stores a new message into PostgreSQL
func SaveMessage(msgType, senderID, username, content string, timestamp time.Time) error {
	query := `INSERT INTO messages (type, sender_id, username, content, timestamp) VALUES ($1, $2, $3, $4, $5)`
	_, err := DB.Exec(query, msgType, senderID, username, content, timestamp)
	return err
}

type DBMessage struct {
	Type      string
	SenderID  string
	Username  string
	Content   string
	Timestamp time.Time
}

// GetRecentMessages retrieves the latest messages from PostgreSQL
func GetRecentMessages(limit int) ([]DBMessage, error) {
	// Let's get the latest N messages by ordering DESC but then we need to reverse them. Wait, if we just order ASC we get the oldest instead. 
	// The best way: SELECT * FROM (SELECT ... ORDER BY timestamp DESC LIMIT X) ORDER BY timestamp ASC
	query := `
	SELECT type, sender_id, username, content, timestamp 
	FROM (
		SELECT type, sender_id, username, content, timestamp 
		FROM messages 
		ORDER BY timestamp DESC 
		LIMIT $1
	) sub 
	ORDER BY timestamp ASC`
	
	rows, err := DB.Query(query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []DBMessage
	for rows.Next() {
		var msg DBMessage
		err := rows.Scan(&msg.Type, &msg.SenderID, &msg.Username, &msg.Content, &msg.Timestamp)
		if err == nil {
			messages = append(messages, msg)
		}
	}
	return messages, nil
}
