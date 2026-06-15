# syntax=docker/dockerfile:1

# --- Build stage -------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies first (better layer caching).
COPY package.json package-lock.json ./
RUN npm ci

# The app reads VITE_SPOTIFY_CLIENT_ID at *build time* (Vite inlines env vars
# prefixed with VITE_ into the static bundle). The Client ID is a public
# identifier, not a secret. For a real, usable image pass it in, e.g.:
#   docker build --build-arg VITE_SPOTIFY_CLIENT_ID=xxxx -t cuesheet .
# Without it the build still succeeds; the app just renders a "Setup needed"
# screen at runtime (see IS_CONFIGURED in src/config.ts).
ARG VITE_SPOTIFY_CLIENT_ID=""
ENV VITE_SPOTIFY_CLIENT_ID=$VITE_SPOTIFY_CLIENT_ID

# Public base path for the built assets. Defaults to root (this nginx image
# serves at '/'); override for a sub-path deploy, e.g.:
#   docker build --build-arg BASE_PATH=/CueSheet/ -t cuesheet .
ARG BASE_PATH="/"
ENV BASE_PATH=$BASE_PATH

COPY . .
RUN npm run build

# --- Runtime stage -----------------------------------------------------------
FROM nginx:alpine AS runtime

# SPA-friendly config + security headers. Shipped as an nginx env-template: the
# base image's entrypoint runs envsubst over /etc/nginx/templates/*.template at
# startup, writing /etc/nginx/conf.d/default.conf (overwriting the stock one).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

# Optional CORS for the served static files — empty by default (no CORS header).
# Override at run time, e.g. -e CORS_ALLOW_ORIGIN=https://app.example.com (or "*").
# Defined here so envsubst always resolves ${CORS_ALLOW_ORIGIN} (to empty) rather
# than leaving the literal placeholder in the config.
ENV CORS_ALLOW_ORIGIN=""

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
