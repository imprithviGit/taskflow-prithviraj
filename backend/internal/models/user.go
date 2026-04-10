package models

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Password  string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
}

type UserStore struct {
	db *sql.DB
}

func NewUserStore(db *sql.DB) *UserStore {
	return &UserStore{db: db}
}

func (s *UserStore) Create(name, email, password string) (*User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	if err != nil {
		return nil, fmt.Errorf("hashing password: %w", err)
	}

	user := &User{
		ID:        uuid.New(),
		Name:      name,
		Email:     email,
		Password:  string(hash),
		CreatedAt: time.Now().UTC(),
	}

	_, err = s.db.Exec(
		`INSERT INTO users (id, name, email, password, created_at) VALUES ($1, $2, $3, $4, $5)`,
		user.ID, user.Name, user.Email, user.Password, user.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting user: %w", err)
	}
	return user, nil
}

func (s *UserStore) FindByEmail(email string) (*User, error) {
	user := &User{}
	err := s.db.QueryRow(
		`SELECT id, name, email, password, created_at FROM users WHERE email = $1`,
		email,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Password, &user.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("querying user: %w", err)
	}
	return user, nil
}

func (s *UserStore) FindByID(id uuid.UUID) (*User, error) {
	user := &User{}
	err := s.db.QueryRow(
		`SELECT id, name, email, created_at FROM users WHERE id = $1`,
		id,
	).Scan(&user.ID, &user.Name, &user.Email, &user.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("querying user: %w", err)
	}
	return user, nil
}

func (u *User) CheckPassword(password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(u.Password), []byte(password)) == nil
}
