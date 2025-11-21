# ========================
# Stage 1: Development
# ========================
FROM node:20-alpine AS dev

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source files
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Command for development
CMD ["npm", "run", "dev"]

# ========================
# Stage 2: Production
# ========================
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy source files
COPY . .

# Build the app
RUN npm run build

# ========================
# Stage 3: Serve with NGINX
# ========================
FROM nginx:alpine AS prod

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: custom NGINX config for SPA routing
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose NGINX port
EXPOSE 80

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]
