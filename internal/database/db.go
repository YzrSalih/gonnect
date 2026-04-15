package database

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/lib/pq"
)

var DB *sql.DB

func InitDB() {
	var err error
	
	host := os.Getenv("DB_HOST")
	if host == "" {
		host = "localhost"
	}
	// PostgreSQL connection string
	connStr := fmt.Sprintf("postgres://gonnect_user:gonnect_password@%s:5432/gonnect_db?sslmode=disable", host)
	
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
	query1 := `
	CREATE TABLE IF NOT EXISTS users (
		id VARCHAR(100) PRIMARY KEY,
		phone_number VARCHAR(20) UNIQUE NOT NULL,
		nickname VARCHAR(100) NOT NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
	);`
	_, err := DB.Exec(query1)
	if err != nil {
		log.Fatal("Failed to create users table:", err)
	}

	query2 := `
	CREATE TABLE IF NOT EXISTS messages (
		id SERIAL PRIMARY KEY,
		type VARCHAR(50),
		sender_id VARCHAR(100),
		username VARCHAR(100),
		target_id VARCHAR(100),
		content TEXT,
		timestamp TIMESTAMP
	);`
	_, err = DB.Exec(query2)
	if err != nil {
		log.Fatal("Failed to create messages table:", err)
	}

	// Safe schema migration for existing databases
	alterQuery := `ALTER TABLE messages ADD COLUMN IF NOT EXISTS target_id VARCHAR(100);`
	_, err = DB.Exec(alterQuery)
	if err != nil {
		log.Println("Note: target_id alter table column check failed or already exists.", err)
	}
}

// SaveMessage stores a new message into PostgreSQL
func SaveMessage(msgType, senderID, username, targetID, content string, timestamp time.Time) error {
	query := `INSERT INTO messages (type, sender_id, username, target_id, content, timestamp) VALUES ($1, $2, $3, $4, $5, $6)`
	_, err := DB.Exec(query, msgType, senderID, username, targetID, content, timestamp)
	return err
}

type DBMessage struct {
	Type       string
	SenderID   string
	Username   string
	TargetID   string
	TargetName string
	Content    string
	Timestamp  time.Time
}

// GetRecentMessages retrieves the latest messages from PostgreSQL
func GetRecentMessages(limit int) ([]DBMessage, error) {
	query := `
	SELECT type, sender_id, username, target_id, t_name, content, timestamp 
	FROM (
		SELECT m.type, m.sender_id, m.username, m.target_id, u.nickname as t_name, m.content, m.timestamp 
		FROM messages m
		LEFT JOIN users u ON REGEXP_REPLACE(m.target_id, '[^0-9]', '', 'g') = REGEXP_REPLACE(u.phone_number, '[^0-9]', '', 'g')
		ORDER BY m.timestamp DESC 
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
		var target sql.NullString
		var targetName sql.NullString
		err := rows.Scan(&msg.Type, &msg.SenderID, &msg.Username, &target, &targetName, &msg.Content, &msg.Timestamp)
		if err == nil {
			if target.Valid {
				msg.TargetID = target.String
			}
			if targetName.Valid {
				msg.TargetName = targetName.String
			}
			messages = append(messages, msg)
		}
	}
	return messages, nil
}

type User struct {
	ID          string `json:"id"`
	PhoneNumber string `json:"phone_number"`
	Nickname    string `json:"nickname"`
}

// LoginOrRegister checks if a user exists by phone. If yes, logs them in. If no, registers them.
func LoginOrRegister(phone, nickname string) (User, error) {
	var user User
	err := DB.QueryRow("SELECT id, phone_number, nickname FROM users WHERE phone_number = $1", phone).Scan(&user.ID, &user.PhoneNumber, &user.Nickname)
	
	if err == sql.ErrNoRows {
		// Register logic
		newID := fmt.Sprintf("user_%d", time.Now().UnixNano())
		_, errInsert := DB.Exec("INSERT INTO users (id, phone_number, nickname) VALUES ($1, $2, $3)", newID, phone, nickname)
		if errInsert != nil {
			return user, errInsert
		}
		return User{ID: newID, PhoneNumber: phone, Nickname: nickname}, nil
	} else if err != nil {
		return user, err
	}
	
	// Update nickname if it was provided and changed
	if nickname != "" && user.Nickname != nickname {
		DB.Exec("UPDATE users SET nickname = $1 WHERE phone_number = $2", nickname, phone)
		user.Nickname = nickname
	}

	return user, nil
}
