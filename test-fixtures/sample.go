package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

type HttpMethod string

const (
	GET    HttpMethod = "GET"
	POST   HttpMethod = "POST"
	PUT    HttpMethod = "PUT"
	DELETE HttpMethod = "DELETE"
	PATCH  HttpMethod = "PATCH"
)

type UserRole string

const (
	Admin  UserRole = "admin"
	User   UserRole = "user"
	Viewer UserRole = "viewer"
)

type UserConfig struct {
	Name     string   `json:"name"`
	Email    string   `json:"email"`
	Role     UserRole `json:"role"`
	Settings map[string]interface{} `json:"settings,omitempty"`
}

type ApiResponse struct {
	Status    int         `json:"status"`
	Data      interface{} `json:"data"`
	Message   string      `json:"message"`
	Timestamp int64       `json:"timestamp"`
}

type BaseService struct {
	baseUrl string
	timeout time.Duration
	client  *http.Client
}

func NewBaseService(baseUrl string, timeout time.Duration) *BaseService {
	return &BaseService{
		baseUrl: baseUrl,
		timeout: timeout,
		client:  &http.Client{Timeout: timeout},
	}
}

func (s *BaseService) log(method string, path string) {
	log.Printf("[%s] %s%s", method, s.baseUrl, path)
}

type UserService struct {
	*BaseService
	mu    sync.RWMutex
	users map[string]*UserConfig
}

func NewUserService() *UserService {
	return &UserService{
		BaseService: NewBaseService("https://api.example.com/users", 5*time.Second),
		users:       make(map[string]*UserConfig),
	}
}

func (s *UserService) GetUser(id string) (*ApiResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	user, ok := s.users[id]
	if !ok {
		return &ApiResponse{Status: 404, Message: "Not found", Timestamp: time.Now().Unix()}, nil
	}
	return &ApiResponse{Status: 200, Data: user, Message: "OK", Timestamp: time.Now().Unix()}, nil
}

func (s *UserService) CreateUser(config *UserConfig) (*ApiResponse, error) {
	if err := validateConfig(config); err != nil {
		return &ApiResponse{Status: 400, Message: err.Error(), Timestamp: time.Now().Unix()}, nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	id := generateID()
	s.users[id] = config
	return &ApiResponse{Status: 201, Data: config, Message: "Created", Timestamp: time.Now().Unix()}, nil
}

func (s *UserService) DeleteUser(id string) (*ApiResponse, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.users[id]; !ok {
		return &ApiResponse{Status: 404, Message: "Not found", Timestamp: time.Now().Unix()}, nil
	}
	delete(s.users, id)
	return &ApiResponse{Status: 200, Message: "Deleted", Timestamp: time.Now().Unix()}, nil
}

func (s *UserService) ListUsers() []*UserConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*UserConfig, 0, len(s.users))
	for _, u := range s.users {
		result = append(result, u)
	}
	return result
}

func validateConfig(config *UserConfig) error {
	if config.Name == "" {
		return errors.New("name is required")
	}
	if !strings.Contains(config.Email, "@") {
		return errors.New("invalid email")
	}
	switch config.Role {
	case Admin, User, Viewer:
		return nil
	default:
		return errors.New("invalid role")
	}
}

func generateID() string {
	h := sha256.New()
	io.WriteString(h, fmt.Sprintf("%d", time.Now().UnixNano()))
	return hex.EncodeToString(h.Sum(nil))[:16]
}

func calculateHash(content string) string {
	h := sha256.New()
	h.Write([]byte(content))
	return hex.EncodeToString(h.Sum(nil))
}

func validateEmail(email string) bool {
	return strings.Contains(email, "@") && strings.Contains(email, ".")
}

func paginate(items []interface{}, page int, perPage int) map[string]interface{} {
	start := (page - 1) * perPage
	if start >= len(items) {
		return map[string]interface{}{"items": []interface{}{}, "total": len(items), "pages": 0}
	}
	end := start + perPage
	if end > len(items) {
		end = len(items)
	}
	pages := (len(items) + perPage - 1) / perPage
	return map[string]interface{}{"items": items[start:end], "total": len(items), "pages": pages}
}

func readConfig(path string) (*UserConfig, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var cfg UserConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func writeConfig(path string, cfg *UserConfig) error {
	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0644)
}

func handleUsers(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	response := map[string]string{"status": "ok"}
	json.NewEncoder(w).Encode(response)
}

func main() {
	http.HandleFunc("/api/users", handleUsers)
	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
