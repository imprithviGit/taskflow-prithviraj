package handlers

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/taskflow/backend/internal/auth"
	"github.com/taskflow/backend/internal/models"
)

type AuthHandler struct {
	users      *models.UserStore
	jwtService *auth.JWTService
}

func NewAuthHandler(db *sql.DB, jwtService *auth.JWTService) *AuthHandler {
	return &AuthHandler{
		users:      models.NewUserStore(db),
		jwtService: jwtService,
	}
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	errs := map[string]string{}
	if strings.TrimSpace(req.Name) == "" {
		errs["name"] = "name is required"
	}
	if !isValidEmail(req.Email) {
		errs["email"] = "valid email is required"
	}
	if len(req.Password) < 8 {
		errs["password"] = "password must be at least 8 characters"
	}
	if len(errs) > 0 {
		writeValidationError(w, errs)
		return
	}

	existing, err := h.users.FindByEmail(r.Context(), req.Email)
	if err != nil {
		slog.Error("checking existing user", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if existing != nil {
		writeValidationError(w, map[string]string{"email": "email already in use"})
		return
	}

	user, err := h.users.Create(r.Context(), req.Name, req.Email, req.Password)
	if err != nil {
		slog.Error("creating user", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	token, err := h.jwtService.Generate(user.ID, user.Email)
	if err != nil {
		slog.Error("generating token", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]interface{}{"token": token, "user": user})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	errs := map[string]string{}
	if req.Email == "" {
		errs["email"] = "email is required"
	}
	if req.Password == "" {
		errs["password"] = "password is required"
	}
	if len(errs) > 0 {
		writeValidationError(w, errs)
		return
	}

	user, err := h.users.FindByEmail(r.Context(), req.Email)
	if err != nil {
		slog.Error("finding user", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if user == nil || !user.CheckPassword(req.Password) {
		writeError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	token, err := h.jwtService.Generate(user.ID, user.Email)
	if err != nil {
		slog.Error("generating token", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{"token": token, "user": user})
}

func isValidEmail(email string) bool {
	return strings.Contains(email, "@") && strings.Contains(email, ".") && len(email) > 3
}
