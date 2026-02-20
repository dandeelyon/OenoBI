SHELL:=/usr/bin/env bash

# Make help the default target
.DEFAULT_GOAL := help

# Export host user/group for consistent volume permissions
export HOST_USER_ID:=$(shell id -u)
export HOST_GROUP_ID:=$(shell id -g)

# Load APP_ENV from .env file
APP_ENV := $(shell grep -E '^APP_ENV=' .env | cut -d '=' -f2 | tr -d '[:space:]')

# Select compose file based on APP_ENV
ifeq ($(APP_ENV),staging)
  COMPOSE_FILE := compose.staging.yml
else
  COMPOSE_FILE := compose.development.yml
endif

$(info -- APP_ENV is "$(APP_ENV)", using $(COMPOSE_FILE))

# Docker compose setup
DOCKER_COMPOSE := docker compose -f $(COMPOSE_FILE)
DOCKER_COMPOSE_UP_DETACH := $(DOCKER_COMPOSE) up --detach
DOCKER_COMPOSE_DOWN := $(DOCKER_COMPOSE) down
DOCKER_COMPOSE_RESTART := $(DOCKER_COMPOSE) restart


##@ Building

.PHONY: build
build: ## (Force) Build the docker images for all services or a specific SERVICE_NAME (eg. make build SERVICE_NAME=backend)
	$(if $(SERVICE_NAME), $(info -- Building $(SERVICE_NAME)), $(info -- Building all services, SERVICE_NAME not set.))
	$(DOCKER_COMPOSE) build $(SERVICE_NAME)


##@ Start/Stop/Restart

.PHONY: start-all start start-backend start-frontend start-db stop-all stop stop-backend stop-frontend stop-db restart restart-backend restart-frontend restart-db

start-all: ## Start all the project service containers daemonised
	$(DOCKER_COMPOSE_UP_DETACH)

start: ## Start individual project service container (Filtered via SERVICE_NAME, eg. make start SERVICE_NAME=backend)
	$(if $(SERVICE_NAME), $(DOCKER_COMPOSE_UP_DETACH) $(SERVICE_NAME), $(error -- SERVICE_NAME must be set, e.g., make start SERVICE_NAME=backend))

start-backend: ## Start only the backend service
	$(DOCKER_COMPOSE_UP_DETACH) backend

start-frontend: ## Start only the frontend service
	$(DOCKER_COMPOSE_UP_DETACH) frontend

start-db: ## Start only the database service
	$(DOCKER_COMPOSE_UP_DETACH) db

stop-all: ## Stop all the project service containers
	$(DOCKER_COMPOSE_DOWN)

stop: ## Stop individual project service container (Filtered via SERVICE_NAME, eg. make stop SERVICE_NAME=backend)
	$(if $(SERVICE_NAME), $(DOCKER_COMPOSE_DOWN) $(SERVICE_NAME), $(error -- SERVICE_NAME must be set, e.g., make stop SERVICE_NAME=backend))

stop-backend: ## Stop only the backend service
	$(DOCKER_COMPOSE_DOWN) backend

stop-frontend: ## Stop only the frontend service
	$(DOCKER_COMPOSE_DOWN) frontend

stop-db: ## Stop only the database service
	$(DOCKER_COMPOSE_DOWN) db

restart: ## Restart individual project service container (Filtered via SERVICE_NAME, eg. make restart SERVICE_NAME=backend)
	$(if $(SERVICE_NAME), $(DOCKER_COMPOSE_RESTART) $(SERVICE_NAME), $(error -- SERVICE_NAME must be set, e.g., make restart SERVICE_NAME=backend))

restart-backend: ## Restart only the backend service
	$(DOCKER_COMPOSE_RESTART) backend

restart-frontend: ## Restart only the frontend service
	$(DOCKER_COMPOSE_RESTART) frontend

restart-db: ## Restart only the database service
	$(DOCKER_COMPOSE_RESTART) db


##@ Logging

.PHONY: logs
logs: ## Tail the logs for the project service containers (Filtered via SERVICE_NAME, eg. make logs SERVICE_NAME=db)
	$(if $(SERVICE_NAME), $(info -- Tailing logs for $(SERVICE_NAME)), $(info -- Tailing all logs, SERVICE_NAME not set.))
	$(DOCKER_COMPOSE) logs -f $(SERVICE_NAME)


##@ Shell

.PHONY: bash-frontend bash-backend bash

bash-frontend: ## Spawn a bash shell for frontend service
	$(DOCKER_COMPOSE) run --rm frontend /bin/bash

bash-backend: ## Spawn a bash shell for backend service
	$(DOCKER_COMPOSE) run --rm backend /bin/bash

bash: ## Spawn a bash shell for individual project service container (Filtered via SERVICE_NAME, eg. make bash SERVICE_NAME=backend)
	$(if $(SERVICE_NAME), $(DOCKER_COMPOSE) run --rm $(SERVICE_NAME) /bin/bash, $(error -- SERVICE_NAME must be set, e.g., make bash SERVICE_NAME=backend))


##@ Database

.PHONY: reset-db
reset-db: ## Stop and remove the PostgreSQL container and its volume, then restart to create a fresh DB
	$(DOCKER_COMPOSE) down -v db
	$(DOCKER_COMPOSE) up -d db


##@ Cleanup

.PHONY: prune-docker
prune-docker: ## Cleanup dangling/orphaned docker resources, executor results, and snapshots
	docker system prune --volumes -f


##@ Help

.PHONY: help
help: ## Display this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-25s\033[0m %s\n", $$1, $$2}'