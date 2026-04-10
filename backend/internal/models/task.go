package models

import (
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

type TaskStore struct {
	db *sql.DB
}

func NewTaskStore(db *sql.DB) *TaskStore {
	return &TaskStore{db: db}
}

func (s *TaskStore) Create(t *Task) (*Task, error) {
	t.ID = uuid.New()
	t.CreatedAt = time.Now().UTC()
	t.UpdatedAt = time.Now().UTC()

	_, err := s.db.Exec(`
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

func (s *TaskStore) ListByProject(projectID uuid.UUID, status, assigneeID string) ([]*Task, error) {
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

	rows, err := s.db.Query(query, args...)
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
	return tasks, nil
}

func (s *TaskStore) FindByID(id uuid.UUID) (*Task, error) {
	t := &Task{}
	err := s.db.QueryRow(`
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

// Update applies only the non-nil fields in u. Column names are hardcoded (not user input).
func (s *TaskStore) Update(id uuid.UUID, u *TaskUpdate) (*Task, error) {
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
		return s.FindByID(id)
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
	err := s.db.QueryRow(query, args...).Scan(
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

func (s *TaskStore) Delete(id uuid.UUID) error {
	result, err := s.db.Exec(`DELETE FROM tasks WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting task: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
