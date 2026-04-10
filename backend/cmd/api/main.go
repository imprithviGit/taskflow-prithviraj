package main

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"

	"github.com/taskflow/backend/internal/auth"
	"github.com/taskflow/backend/internal/database"
	"github.com/taskflow/backend/internal/handlers"
	mw "github.com/taskflow/backend/internal/middleware"
	"github.com/taskflow/backend/internal/models"
)

func main() {
	_ = godotenv.Load()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	db, err := database.Connect()
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := database.RunMigrations(db); err != nil {
		slog.Error("failed to run migrations", "error", err)
		os.Exit(1)
	}

	runSeed(db)

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		slog.Error("JWT_SECRET environment variable is required")
		os.Exit(1)
	}
	jwtService := auth.NewJWTService(jwtSecret)

	authHandler := handlers.NewAuthHandler(db, jwtService)
	projectHandler := handlers.NewProjectHandler(db)
	taskHandler := handlers.NewTaskHandler(db)

	r := chi.NewRouter()
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type", "X-Request-ID"},
	}))

	r.Post("/auth/register", authHandler.Register)
	r.Post("/auth/login", authHandler.Login)

	r.Group(func(r chi.Router) {
		r.Use(mw.JWTAuth(jwtService))

		r.Get("/projects", projectHandler.List)
		r.Post("/projects", projectHandler.Create)
		r.Get("/projects/{id}", projectHandler.Get)
		r.Patch("/projects/{id}", projectHandler.Update)
		r.Delete("/projects/{id}", projectHandler.Delete)
		r.Get("/projects/{id}/stats", projectHandler.Stats)

		r.Get("/projects/{id}/tasks", taskHandler.ListByProject)
		r.Post("/projects/{id}/tasks", taskHandler.Create)
		r.Patch("/tasks/{id}", taskHandler.Update)
		r.Delete("/tasks/{id}", taskHandler.Delete)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:         fmt.Sprintf(":%s", port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	go func() {
		slog.Info("server starting", "port", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	<-quit
	slog.Info("shutting down server")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("server shutdown error", "error", err)
	}
	slog.Info("server stopped")
}

func runSeed(db *sql.DB) {
	ctx := context.Background()
	userStore := models.NewUserStore(db)

	existing, err := userStore.FindByEmail(ctx, "demo@taskflow.com")
	if err != nil || existing != nil {
		return
	}

	user, err := userStore.Create(ctx, "Demo User", "demo@taskflow.com", "password123")
	if err != nil {
		slog.Warn("seed: create user failed", "error", err)
		return
	}

	projectStore := models.NewProjectStore(db)
	desc := "A sample project to get you started"
	project, err := projectStore.Create(ctx, "Demo Project", &desc, user.ID)
	if err != nil {
		slog.Warn("seed: create project failed", "error", err)
		return
	}

	taskStore := models.NewTaskStore(db)
	seeds := []struct {
		title, desc, status, priority string
	}{
		{"Set up development environment", "Install all required tools and dependencies", "done", "high"},
		{"Design database schema", "Create ERD and write migrations", "in_progress", "high"},
		{"Implement REST API endpoints", "Build out all CRUD endpoints", "todo", "medium"},
	}

	for _, s := range seeds {
		d := s.desc
		if _, err := taskStore.Create(ctx, &models.Task{
			Title:       s.title,
			Description: &d,
			Status:      models.TaskStatus(s.status),
			Priority:    models.TaskPriority(s.priority),
			ProjectID:   project.ID,
		}); err != nil {
			slog.Warn("seed: create task failed", "error", err)
		}
	}

	slog.Info("seed data created", "email", "demo@taskflow.com", "password", "password123")
}
