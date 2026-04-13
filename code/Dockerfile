FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for pymupdf
RUN apt-get update && apt-get install -y \
    libmupdf-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY pyproject.toml ./
RUN pip install --no-cache-dir -e .

# Copy source
COPY sifter/ ./sifter/

# Copy frontend build if exists
COPY frontend/dist/ ./frontend/dist/ 2>/dev/null || true

EXPOSE 8000

CMD ["python", "-m", "sifter.main"]
