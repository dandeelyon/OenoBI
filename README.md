# Executive ERP Dashboard

This is a code bundle for Executive ERP Dashboard. The original project is available at https://www.figma.com/design/Vu2rdpobSs6YJJz8tv5fyk/Executive-ERP-Dashboard.

## Local Development Setup

To get this project running locally using Docker, follow these steps:

### Prerequisites

*   **Docker Desktop:** Make sure you have Docker Desktop installed and running. You can download it from [https://www.docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop). Docker Compose is included with Docker Desktop.

### Setup Instructions

1.  **Clone the Repository:**
    ```bash
    git clone [repository_url]
    cd OenoBI
    ```
    (Replace `[repository_url]` with the actual URL of your repository.)

2.  **Build Docker Images:**
    Build the Docker images for both the frontend and backend services.
    ```bash
    make build
    ```

3.  **Start Services:**
    Start all the project services (PostgreSQL database, backend API, and frontend development server) in detached mode.
    ```bash
    make start-all
    ```

4.  **Access the Frontend:**
    Once all services are up, open your web browser and navigate to:
    [http://localhost:3000](http://localhost:3000)

### Useful Commands

*   **View Logs:**
    To tail the logs of all running services:
    ```bash
    make logs
    ```
    To tail logs of a specific service (e.g., `frontend`, `backend`, `db`):
    ```bash
    make logs SERVICE_NAME=frontend
    ```

*   **Stop Services:**
    To stop all running services:
    ```bash
    make stop-all
    ```

*   **Reset Database:**
    To stop and remove the PostgreSQL container and its data volume, then restart it with fresh data:
    ```bash
    make reset-db
    ```

*   **Access Shell:**
    To get a bash shell inside the frontend container:
    ```bash
    make bash-frontend
    ```
    To get a bash shell inside the backend container:
    ```bash
    make bash-backend
    ```

### Environment Variables

The backend and frontend services require certain environment variables. These can be set in a `.env` file in the root directory (e.g., `COMMERCE7_API_KEY`, `COMMERCE7_TENANT_ID`, `VINTRACE_API_KEY`, `VINTRACE_BASE_URL`).

Example `.env` file:
```
COMMERCE7_API_KEY=your_commerce7_api_key
COMMERCE7_TENANT_ID=your_commerce7_tenant_id
VINTRACE_API_KEY=your_vintrace_api_key
VINTRACE_BASE_URL=https://us30.vintrace.net/bla
```

Inside the backend folder:
- Add allowlist.txt file that allows only specific users to login.

### TODO
1. Change the backend to be in Python so that the ETL pipeline is hosted through Python rather than deno. (50%)
2. Add Authentication according to the priority. (done)
3. Add insights generator using LLM (toodo)
