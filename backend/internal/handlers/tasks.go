package handlers

import (
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	mw "github.com/taskflow/backend/internal/middleware"
	"github.com/taskflow/backend/internal/models"
)

type TaskHandler struct {
	tasks    *models.TaskStore
	projects *models.ProjectStore
}

func NewTaskHandler(db *sql.DB) *TaskHandler {
	return &TaskHandler{
		tasks:    models.NewTaskStore(db),
		projects: models.NewProjectStore(db),
	}
}

func (h *TaskHandler) ListByProject(w http.ResponseWriter, r *http.Request) {
	userID := mw.GetUserID(r.Context())
	project, ok := h.requireOwnedProject(w, r, userID)
	if !ok {
		return
	}

	status := r.URL.Query().Get("status")
	assignee := r.URL.Query().Get("assignee")

	tasks, err := h.tasks.ListByProject(project.ID, status, assignee)
	if err != nil {
		slog.Error("listing tasks", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if tasks == nil {
		tasks = []*models.Task{}
	}
	writeJSON(w, http.StatusOK, tasks)
}

func (h *TaskHandler) Create(w http.ResponseWriter, r *http.Request) {
	userID := mw.GetUserID(r.Context())
	project, ok := h.requireOwnedProject(w, r, userID)
	if !ok {
		return
	}

	var req struct {
		Title       string  `json:"title"`
		Description *string `json:"description"`
		Status      string  `json:"status"`
		Priority    string  `json:"priority"`
		AssigneeID  *string `json:"assignee_id"`
		DueDate     *string `json:"due_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	errs := map[string]string{}
	if strings.TrimSpace(req.Title) == "" {
		errs["title"] = "title is required"
	}
	if req.Status == "" {
		req.Status = "todo"
	} else if !validStatus(req.Status) {
		errs["status"] = "status must be todo, in_progress, or done"
	}
	if req.Priority == "" {
		req.Priority = "medium"
	} else if !validPriority(req.Priority) {
		errs["priority"] = "priority must be low, medium, or high"
	}
	if len(errs) > 0 {
		writeValidationError(w, errs)
		return
	}

	task := &models.Task{
		Title:       req.Title,
		Description: req.Description,
		Status:      models.TaskStatus(req.Status),
		Priority:    models.TaskPriority(req.Priority),
		ProjectID:   project.ID,
	}

	if req.AssigneeID != nil {
		aid, err := uuid.Parse(*req.AssigneeID)
		if err != nil {
			writeValidationError(w, map[string]string{"assignee_id": "invalid uuid"})
			return
		}
		task.AssigneeID = &aid
	}
	if req.DueDate != nil {
		t, err := parseDate(*req.DueDate)
		if err != nil {
			writeValidationError(w, map[string]string{"due_date": "use RFC3339 or YYYY-MM-DD"})
			return
		}
		task.DueDate = &t
	}

	created, err := h.tasks.Create(task)
	if err != nil {
		slog.Error("creating task", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusCreated, created)
}

func (h *TaskHandler) Update(w http.ResponseWriter, r *http.Request) {
	userID := mw.GetUserID(r.Context())
	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}

	task, err := h.tasks.FindByID(taskID)
	if err != nil {
		slog.Error("finding task", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if task == nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	project, err := h.projects.FindByID(task.ProjectID)
	if err != nil || project == nil || project.OwnerID != userID {
		writeError(w, http.StatusForbidden, "access denied")
		return
	}

	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		Status      *string `json:"status"`
		Priority    *string `json:"priority"`
		AssigneeID  *string `json:"assignee_id"`
		DueDate     *string `json:"due_date"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	errs := map[string]string{}
	if req.Status != nil && !validStatus(*req.Status) {
		errs["status"] = "status must be todo, in_progress, or done"
	}
	if req.Priority != nil && !validPriority(*req.Priority) {
		errs["priority"] = "priority must be low, medium, or high"
	}
	if len(errs) > 0 {
		writeValidationError(w, errs)
		return
	}

	update := &models.TaskUpdate{
		Title:       req.Title,
		Description: req.Description,
	}
	if req.Status != nil {
		s := models.TaskStatus(*req.Status)
		update.Status = &s
	}
	if req.Priority != nil {
		p := models.TaskPriority(*req.Priority)
		update.Priority = &p
	}
	if req.AssigneeID != nil {
		aid, err := uuid.Parse(*req.AssigneeID)
		if err != nil {
			writeValidationError(w, map[string]string{"assignee_id": "invalid uuid"})
			return
		}
		update.AssigneeID = &aid
	}
	if req.DueDate != nil {
		t, err := parseDate(*req.DueDate)
		if err != nil {
			writeValidationError(w, map[string]string{"due_date": "use RFC3339 or YYYY-MM-DD"})
			return
		}
		update.DueDate = &t
	}

	updated, err := h.tasks.Update(taskID, update)
	if err != nil {
		slog.Error("updating task", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

func (h *TaskHandler) Delete(w http.ResponseWriter, r *http.Request) {
	userID := mw.GetUserID(r.Context())
	taskID, err := uuid.Parse(chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid task id")
		return
	}

	task, err := h.tasks.FindByID(taskID)
	if err != nil {
		slog.Error("finding task", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	if task == nil {
		writeError(w, http.StatusNotFound, "task not found")
		return
	}

	project, err := h.projects.FindByID(task.ProjectID)
	if err != nil || project == nil || project.OwnerID != userID {
		writeError(w, http.StatusForbidden, "access denied")
		return
	}

	if err := h.tasks.Delete(taskID); err != nil {
		slog.Error("deleting task", "error", err)
		writeError(w, http.StatusInternalServerError, "internal server error")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *TaskHandler) requireOwnedProject(w http.ResponseWriter, r *http.Request, userID uuid.UUID) (*models.Project, bool) {
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

func validStatus(s string) bool {
	return s == "todo" || s == "in_progress" || s == "done"
}

func validPriority(p string) bool {
	return p == "low" || p == "medium" || p == "high"
}

func parseDate(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t, nil
	}
	return time.Parse("2006-01-02", s)
}
