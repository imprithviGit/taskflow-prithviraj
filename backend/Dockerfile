# ── Build stage ──────────────────────────────────────────────────────────────
FROM golang:1.22-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git

# Allow go to update go.sum on first build (no committed go.sum required)
ENV GOFLAGS="-mod=mod"
ENV CGO_ENABLED=0
ENV GOOS=linux

COPY go.mod ./
COPY . .

RUN go build -ldflags="-s -w" -o server ./cmd/api

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM alpine:3.19

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /app/server .
COPY migrations ./migrations

ENV MIGRATIONS_PATH=file:///app/migrations

EXPOSE 8080

CMD ["./server"]
