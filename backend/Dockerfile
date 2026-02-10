FROM python:3.10-slim-buster

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Use Gunicorn with Uvicorn workers for production, Uvicorn for development
# For local development, direct uvicorn command is fine
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
