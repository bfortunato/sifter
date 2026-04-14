# Self-Hosting

Sifter is designed to run anywhere: your laptop, a VPS, or a Kubernetes cluster. This guide covers the full setup.

## Quick Start

```bash
git clone https://github.com/sifter-ai/sifter.git
cd sifter
cp code/.env.example code/.env  # edit with your API key
./code/run.sh
```

That's it. The script starts MongoDB (via Docker), the FastAPI backend, and the React frontend.

- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`

## Environment Variables

Edit `code/.env` to configure Sifter:

| Variable | Default | Description |
|----------|---------|-------------|
| `SIFTER_LLM_API_KEY` | *(required)* | API key for your LLM provider |
| `SIFTER_LLM_MODEL` | `openai/gpt-4o` | LiteLLM model string for extraction |
| `SIFTER_PIPELINE_MODEL` | `openai/gpt-4o-mini` | Faster model used for pipelines |
| `SIFTER_MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `SIFTER_MONGODB_DATABASE` | `sifter` | Database name |
| `SIFTER_JWT_SECRET` | *(change this!)* | JWT signing secret — must be changed in production |
| `SIFTER_MAX_WORKERS` | `4` | Number of concurrent document processing workers |
| `SIFTER_STORAGE_PATH` | `./uploads` | Directory where uploaded files are stored |
| `SIFTER_MAX_FILE_SIZE_MB` | `50` | Maximum upload file size in MB |
| `SIFTER_HOST` | `0.0.0.0` | Server bind address |
| `SIFTER_PORT` | `8000` | Server port |
| `SIFTER_CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed CORS origins |

## LLM Providers

Sifter uses [LiteLLM](https://docs.litellm.ai/) under the hood, so you can swap providers by changing the model string.

**OpenAI**

```bash
SIFTER_LLM_API_KEY=sk-...
SIFTER_LLM_MODEL=openai/gpt-4o
SIFTER_PIPELINE_MODEL=openai/gpt-4o-mini
```

**Anthropic**

```bash
SIFTER_LLM_API_KEY=sk-ant-...
SIFTER_LLM_MODEL=anthropic/claude-3-5-sonnet-20241022
SIFTER_PIPELINE_MODEL=anthropic/claude-3-haiku-20240307
```

**Azure OpenAI**

```bash
SIFTER_LLM_API_KEY=your-azure-key
SIFTER_LLM_MODEL=azure/gpt-4o
AZURE_API_BASE=https://your-resource.openai.azure.com/
AZURE_API_VERSION=2024-02-01
```

**Local (Ollama)**

```bash
SIFTER_LLM_API_KEY=ollama
SIFTER_LLM_MODEL=ollama/llama3.2
```

::: tip
For best extraction quality, use a frontier model (GPT-4o, Claude 3.5 Sonnet). Local models work but may produce less consistent schemas.
:::

## MongoDB

The default setup uses Docker to run MongoDB automatically via `run.sh`. For production, use a managed instance:

**MongoDB Atlas (recommended for production)**

```bash
SIFTER_MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/
SIFTER_MONGODB_DATABASE=sifter
```

**Self-managed replica set**

```bash
SIFTER_MONGODB_URI=mongodb://host1:27017,host2:27017,host3:27017/?replicaSet=rs0
```

## Production Checklist

Before going live, work through these items:

- **Change `SIFTER_JWT_SECRET`** to a random 64-character string:
  ```bash
  openssl rand -hex 32
  ```
- **Use a managed MongoDB** instance (Atlas, MongoDB Ops Manager, etc.) with authentication enabled
- **Set `SIFTER_CORS_ORIGINS`** to your frontend domain (e.g. `https://app.example.com`)
- **Put Sifter behind a reverse proxy** (nginx or Caddy) with HTTPS and TLS termination
- **Set `SIFTER_STORAGE_PATH`** to a persistent volume — local disk is lost on container restart
- **Scale workers** by increasing `SIFTER_MAX_WORKERS` (or running multiple instances behind a load balancer)

## Nginx Example

```nginx
server {
    listen 443 ssl;
    server_name sifter.example.com;

    ssl_certificate /etc/letsencrypt/live/sifter.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sifter.example.com/privkey.pem;

    location /api/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 100M;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
    }
}
```

## Caddy Example

```caddyfile
sifter.example.com {
    handle /api/* {
        reverse_proxy localhost:8000
    }
    handle {
        reverse_proxy localhost:3000
    }
}
```

Caddy provisions TLS certificates from Let's Encrypt automatically.
