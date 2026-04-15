FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm install

# Copy source files and build for production
COPY . .
RUN npm run build

# Use Nginx to serve static files cleanly
FROM nginx:alpine
# Copy built Vite dist files to Nginx web root
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose standard HTTP port
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
