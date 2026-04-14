# Self-Hosting

Sifter is designed to run anywhere: your laptop, a VPS, or a Kubernetes cluster. This guide covers the full setup.

## Quick Start

```bash
git clone https://github.com/sifter-ai/sifter.git
cd sifter
cp code/.env.example code/.env
# Edit code/.env and set SIFTER_LLM_API_KEY
./code/run.sh
```

Opens:
- UI: http://localhost:3000
- API: http://localhost:8000
- API docs: http://localhost:8000/docs

## Prerequisites

- Python 3.10+
- Node.js 18+
- Docker (for MongoDB via run.sh)
- An API key for a supported LLM provider

## Configuration

Edit `code/.env` (copy from `code/.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `SIFTER_LLM_API_KEY` | *(required)* | LLM provider API key |
| `SIFTER_LLM_MODEL` | `openai/gpt-4o` | LiteLLM model string for extraction |
| `SIFTER_PIPELINE_MODEL` | `openai/gpt-4o-mini` | Faster model for aggregation pipelines |
| `SIFTER_MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `SIFTER_MONGODB_DATABASE` | `sifter` | Database name |
| `SIFTER_JWT_SECRET` | `dev-secret-...` | **Change in production** — random 64-char string |
| `SIFTER_JWT_EXPIRE_MINUTES` | `1440` | JWT TTL (24h default) |
| `SIFTER_STORAGE_PATH` | `./uploads` | Where uploaded files are stored |
| `SIFTER_MAX_FILE_SIZE_MB` | `50` | Maximum upload size |
| `SIFTER_MAX_WORKERS` | `4` | Concurrent document processing workers |
| `SIFTER_HOST` | `0.0.0.0` | Bind address |
| `SIFTER_PORT` | `8000` | Server port |
| `SIFTER_CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed CORS origins |

## LLM Providers

Sifter uses [LiteLLM](https://docs.litellm.ai/) — any compatible provider works by changing the model string:

| Provider | Model string example |
|----------|---------------------|
| OpenAI | `openai/gpt-4o` |
| Anthropic | `anthropic/claude-3-5-sonnet-20241022` |
| Azure OpenAI | `azure/gpt-4o` |
| Google Gemini | `gemini/gemini-1.5-pro` |
| Local (Ollama) | `ollama/llama3.2` |

Set `SIFTER_LLM_API_KEY` to the appropriate key for your provider. For Ollama, leave it empty.

::: tip
For best extraction quality, use a frontier model (GPT-4o, Claude 3.5 Sonnet). Local models work but may produce less consistent schemas.
:::

## Docker Compose (Recommended for Production)

```bash
docker compose -f code/docker-compose.yml up -d
```

This starts:
- MongoDB 7 with persistent volume
- Sifter API on port 8000
- Sifter UI (nginx) on port 3000

To update to the latest version:
```bash
docker compose -f code/docker-compose.yml pull
docker compose -f code/docker-compose.yml up -d
```

## MongoDB

The default setup uses Docker to run MongoDB automatically via `run.sh`. For production, use a managed instance:

**MongoDB Atlas (recommended)**

```bash
SIFTER_MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
SIFTER_MONGODB_DATABASE=sifter
```

**Self-managed replica set**

```bash
SIFTER_MONGODB_URI=mongodb://host1:27017,host2:27017,host3:27017/?replicaSet=rs0
```

## Reverse Proxy (nginx)

Example nginx config to put Sifter behind a domain with TLS:

```nginx
server {
    listen 443 ssl;
    server_name sifter.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/sifter.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sifter.yourdomain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 100M;
    }
}
```

## Caddy Example

```caddyfile
sifter.yourdomain.com {
    handle /api/* {
        reverse_proxy localhost:8000
    }
    handle {
        reverse_proxy localhost:3000
    }
}
```

Caddy provisions TLS certificates from Let's Encrypt automatically.

## Production Checklist

- [ ] Change `SIFTER_JWT_SECRET` to a random 64-char string (`openssl rand -hex 32`)
- [ ] Use a managed MongoDB instance (Atlas free tier works well)
- [ ] Set `SIFTER_CORS_ORIGINS` to your frontend domain
- [ ] Put behind a reverse proxy with TLS
- [ ] Mount `SIFTER_STORAGE_PATH` to a persistent volume
- [ ] Set `SIFTER_MAX_WORKERS` to number of CPU cores
