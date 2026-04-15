FROM golang:alpine AS builder

WORKDIR /app

# Copy dependency files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code and build
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o main ./cmd/server

# Use a clean alpine image for final stage
FROM alpine:latest
WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /app/main .

# Expose port and run
EXPOSE 8080
CMD ["./main"]
