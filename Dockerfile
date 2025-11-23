# ========================
# Stage 1: Development
# ========================
FROM node:20-alpine AS dev

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]

# ========================
# Stage 2: Build
# ========================
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
# Install ALL dependencies for building
RUN npm install

COPY . .

# Build the app
RUN npm run build

# ========================
# Stage 3: Production
# ========================
FROM nginx:alpine AS prod

# Copy built files from build stage
COPY --from=build /app/dist /usr/share/nginx/html

# Optional: custom NGINX config
# COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
