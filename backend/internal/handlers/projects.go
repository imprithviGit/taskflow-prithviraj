package handlers

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	mw "github.com/taskflow/backend/internal/middleware"
	"github.com/taskflow/backend/internal/models"
)

type ProjectHandler struct {
	projects *models.ProjectStore
}

func NewProjectHandler(db *sql.DB) *ProjectHandler {
	return &ProjectHandler{projects: models.NewProjectStore(db)}
}

func (h *ProjectHandler) List(w http.ResponseWriter, r *http.Request) {
	userID := mw.GetUserID(r.Context())
	projects, err := h.projects.ListByOwner(userID)
	if err != nil {
		slog.Error("listing projects", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if projects == nil {
		projects = []*models.Project{}
	}
	writeJSON(w, http.StatusOK, projects)
}

func (h *ProjectHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := mw.GetUserID(r.Context())

	var req struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeValidationError(w, map[string]string{"name": "name is required"})
		return
	}

	project, err := h.projects.Create(req.Name, req.Description, userID)
	if err != nil {
		slog.Error("creating project", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusCreated, project)
}

func (h *ProjectHandler) Get(w http.ResponseWriter, r *http.Request) {
	userID := mw.GetUserID(r.Context())
	project, ok := h.getOwnedProject(w, r, userID)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, project)
}

func (h *ProjectHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := mw.GetUserID(r.Context())
	project, ok := h.getOwnedProject(w, r, userID)
	if !ok {
		return
	}

	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	name := project.Name
	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		name = *req.Name
	}
	desc := project.Description
	if req.Description != nil {
		desc = req.Description
	}

	updated, err := h.projects.Update(project.ID, name, desc)
	if err != nil {
		slog.Error("updating project", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *ProjectHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := mw.GetUserID(r.Context())
	project, ok := h.getOwnedProject(w, r, userID)
	if !ok {
		return
	}

	if err := h.projects.Delete(project.ID); err != nil {
		slog.Error("deleting project", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ProjectHandler) getOwnedProject(w http.ResponseWriter, r *http.Request, userID uuid.UUID) (*models.Project, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid project id")
		return nil, false
	}

	project, err := h.projects.FindByID(id)
	if err != nil {
		slog.Error("finding project", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return nil, false
	}
	if project == nil {
		writeError(w, http.StatusNotFound, "project not found")
		return nil, false
	}
	if project.OwnerID != userID {
		writeError(w, http.StatusForbidden, "access denied")
		return nil, false
	}
	return project, true
}

