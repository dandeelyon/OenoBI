SHELL:=/usr/bin/env bash

# Docker compose setup
DOCKER_COMPOSE := docker compose -f compose.development.yml


##@ Building
.PHONY: build
build: ## Build the docker images
	$(DOCKER_COMPOSE) build

##@ Start/Stop/Restart
.PHONY: start-all stop-all

start-all: ## Start all the project service containers daemonised
	$(DOCKER_COMPOSE) up -d

stop-all: ## Stop all the project service containers
	$(DOCKER_COMPOSE) down

##@ Logging

.PHONY: logs
logs: ## Tail the logs for the project service containers (Filtered via SERVICE_NAME, eg. make logs SERVICE_NAME=db)
	$(if $(SERVICE_NAME), $(info -- Tailing logs for $(SERVICE_NAME)), $(info -- Tailing all logs, SERVICE_NAME not set.))
	$(DOCKER_COMPOSE) logs -f $(SERVICE_NAME)

##@ Shell
.PHONY: bash-frontend bash-backend

bash-frontend: ## Spawn a bash shell for frontend service
	$(DOCKER_COMPOSE) run --rm frontend /bin/bash

bash-backend: ## Spawn a bash shell for backend service
	$(DOCKER_COMPOSE) run --rm backend /bin/bash

##@ Database
.PHONY: reset-db
reset-db: ## Stop and remove the PostgreSQL container and its volume, then restart to create a fresh DB
	$(DOCKER_COMPOSE) down -v db
	$(DOCKER_COMPOSE) up -d db
