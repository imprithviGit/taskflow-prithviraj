package models

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type TaskStatus string
type TaskPriority string

const (
	StatusTodo       TaskStatus = "todo"
	StatusInProgress TaskStatus = "in_progress"
	StatusDone       TaskStatus = "done"

	PriorityLow    TaskPriority = "low"
	PriorityMedium TaskPriority = "medium"
	PriorityHigh   TaskPriority = "high"
)

type Task struct {
	ID          uuid.UUID    `json:"id"`
	Title       string       `json:"title"`
	Description *string      `json:"description"`
	Status      TaskStatus   `json:"status"`
	Priority    TaskPriority `json:"priority"`
	ProjectID   uuid.UUID    `json:"project_id"`
	AssigneeID  *uuid.UUID   `json:"assignee_id"`
	DueDate     *time.Time   `json:"due_date"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

type TaskUpdate struct {
	Title       *string
	Description *string
	Status      *TaskStatus
	Priority    *TaskPriority
	AssigneeID  *uuid.UUID
	DueDate     *time.Time
}

type ProjectStats struct {
	Total          int `json:"total"`
	Todo           int `json:"todo"`
	InProgress     int `json:"in_progress"`
	Done           int `json:"done"`
	HighPriority   int `json:"high_priority"`
	MediumPriority int `json:"medium_priority"`
	LowPriority    int `json:"low_priority"`
}

type TaskStore struct {
	db *sql.DB
}

func NewTaskStore(db *sql.DB) *TaskStore {
	return &TaskStore{db: db}
}

func (s *TaskStore) Create(ctx context.Context, t *Task) (*Task, error) {
	t.ID = uuid.New()
	t.CreatedAt = time.Now().UTC()
	t.UpdatedAt = time.Now().UTC()

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO tasks (id, title, description, status, priority, project_id, assignee_id, due_date, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		t.ID, t.Title, t.Description, t.Status, t.Priority,
		t.ProjectID, t.AssigneeID, t.DueDate, t.CreatedAt, t.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("inserting task: %w", err)
	}
	return t, nil
}

func (s *TaskStore) ListByProject(ctx context.Context, projectID uuid.UUID, status, assigneeID string) ([]*Task, error) {
	query := `SELECT id, title, description, status, priority, project_id, assignee_id, due_date, created_at, updated_at
	          FROM tasks WHERE project_id = $1`
	args := []interface{}{projectID}
	idx := 2

	if status != "" {
		query += fmt.Sprintf(" AND status = $%d", idx)
		args = append(args, status)
		idx++
	}
	if assigneeID != "" {
		query += fmt.Sprintf(" AND assignee_id = $%d", idx)
		args = append(args, assigneeID)
	}
	query += " ORDER BY created_at DESC"

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("querying tasks: %w", err)
	}
	defer rows.Close()

	var tasks []*Task
	for rows.Next() {
		t := &Task{}
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
			&t.ProjectID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scanning task: %w", err)
		}
		tasks = append(tasks, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating tasks: %w", err)
	}
	return tasks, nil
}

func (s *TaskStore) FindByID(ctx context.Context, id uuid.UUID) (*Task, error) {
	t := &Task{}
	err := s.db.QueryRowContext(ctx, `
		SELECT id, title, description, status, priority, project_id, assignee_id, due_date, created_at, updated_at
		FROM tasks WHERE id = $1`, id,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.ProjectID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("querying task: %w", err)
	}
	return t, nil
}

// Update applies only the non-nil fields in u.
// Column names are hardcoded (not user-supplied), so the dynamic query is SQL-injection safe.
func (s *TaskStore) Update(ctx context.Context, id uuid.UUID, u *TaskUpdate) (*Task, error) {
	type col struct {
		name string
		val  interface{}
	}
	var cols []col

	if u.Title != nil {
		cols = append(cols, col{"title", *u.Title})
	}
	if u.Description != nil {
		cols = append(cols, col{"description", *u.Description})
	}
	if u.Status != nil {
		cols = append(cols, col{"status", string(*u.Status)})
	}
	if u.Priority != nil {
		cols = append(cols, col{"priority", string(*u.Priority)})
	}
	if u.AssigneeID != nil {
		cols = append(cols, col{"assignee_id", *u.AssigneeID})
	}
	if u.DueDate != nil {
		cols = append(cols, col{"due_date", *u.DueDate})
	}

	if len(cols) == 0 {
		return s.FindByID(ctx, id)
	}

	set := ""
	args := []interface{}{}
	for i, c := range cols {
		if i > 0 {
			set += ", "
		}
		set += fmt.Sprintf("%s = $%d", c.name, i+1)
		args = append(args, c.val)
	}
	set += fmt.Sprintf(", updated_at = $%d", len(args)+1)
	args = append(args, time.Now().UTC())
	args = append(args, id)

	query := fmt.Sprintf(`
		UPDATE tasks SET %s WHERE id = $%d
		RETURNING id, title, description, status, priority, project_id, assignee_id, due_date, created_at, updated_at`,
		set, len(args))

	t := &Task{}
	err := s.db.QueryRowContext(ctx, query, args...).Scan(
		&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.ProjectID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("updating task: %w", err)
	}
	return t, nil
}

func (s *TaskStore) Delete(ctx context.Context, id uuid.UUID) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting task: %w", err)
	}
	n, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("checking rows affected: %w", err)
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (s *TaskStore) GetStats(ctx context.Context, projectID uuid.UUID) (*ProjectStats, error) {
	stats := &ProjectStats{}
	err := s.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE status = 'todo'),
			COUNT(*) FILTER (WHERE status = 'in_progress'),
			COUNT(*) FILTER (WHERE status = 'done'),
			COUNT(*) FILTER (WHERE priority = 'high'),
			COUNT(*) FILTER (WHERE priority = 'medium'),
			COUNT(*) FILTER (WHERE priority = 'low')
		FROM tasks WHERE project_id = $1`, projectID,
	).Scan(
		&stats.Total, &stats.Todo, &stats.InProgress, &stats.Done,
		&stats.HighPriority, &stats.MediumPriority, &stats.LowPriority,
	)
	if err != nil {
		return nil, fmt.Errorf("getting project stats: %w", err)
	}
	return stats, nil
}
