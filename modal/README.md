# Modal vLLM Deployments

Deploy OpenAI-compatible vLLM servers on Modal.com with on-demand GPU scaling.

## Architecture

Two deployment modes are available:

### GPU-Based (Recommended)

Deploy **5 apps** (one per GPU type), each serving **all models**:

```
vllm-l40s   → gemma-3-12b, gemma-3-27b, qwen3-vl-30b
vllm-a100   → gemma-3-12b, gemma-3-27b, qwen3-vl-30b
vllm-h100   → gemma-3-12b, gemma-3-27b, qwen3-vl-30b
vllm-h200   → gemma-3-12b, gemma-3-27b, qwen3-vl-30b
vllm-b200   → gemma-3-12b, gemma-3-27b, qwen3-vl-30b
```

- Uses only **5 endpoints** (stays under Modal's 8 endpoint limit)
- Single endpoint per GPU serves any model
- Model specified in request body
- **Bearer API key authentication**
- **Structured output support** (JSON schema enforcement)

### Legacy: Model-Based

Deploy **15 apps** (one per model × GPU combination):

```
vllm-gemma-3-12b-l40s, vllm-gemma-3-12b-a100, ...
```

- Uses **15 endpoints** (exceeds 8 endpoint limit on free tier)
- Each endpoint serves one model only

## Prerequisites

1. **Modal Account**: Sign up at [modal.com](https://modal.com)

2. **Install Dependencies & Modal CLI**:
   ```bash
   cd modal
   uv sync
   ```

3. **Authenticate with Modal**:
   ```bash
   uv run modal token new
   ```

4. **HuggingFace Token**: Create a Modal secret named `huggingface` with your HF token
   ```bash
   uv run modal secret create huggingface HF_TOKEN=hf_your_token_here
   ```
   This is required for gated models like Gemma.

5. **API Key** (for GPU-based deployment): Create a Modal secret for API authentication
   ```bash
   uv run modal secret create vllm-api-key API_KEY=your-secret-key
   ```

## Available Models

| Base Model | HuggingFace ID |
|------------|----------------|
| `gemma-3-12b` | google/gemma-3-12b-it |
| `gemma-3-27b` | google/gemma-3-27b-it |
| `qwen3-vl-30b` | Qwen/Qwen3-VL-30B-A3B-Instruct |

| GPU | Short Name | VRAM |
|-----|------------|------|
| L40S | `l40s` | 48GB |
| A100-80GB | `a100` | 80GB |
| H100 | `h100` | 80GB |
| H200 | `h200` | 141GB |
| B200 | `b200` | 192GB |

## Deployment

### List Configurations

```bash
uv run python deploy.py --list
```

### GPU-Based Deployment (Recommended)

```bash
# Deploy a single GPU app (serves all models)
uv run python deploy.py --gpu h100
uv run python deploy.py --gpu l40s

# Deploy all 5 GPU apps
uv run python deploy.py --all

# Test a GPU endpoint
uv run python deploy.py --test-gpu h100
uv run python deploy.py --test-gpu h100 --test-model gemma-3-27b

# Get endpoint URL
uv run python deploy.py --url h100
```

### Legacy: Model-Based Deployment

```bash
# Deploy a single model+GPU combination
uv run python deploy.py --model gemma-3-12b-l40s

# Test a deployed model
uv run python deploy.py --test gemma-3-12b-l40s
```

## Using with dex-bench

After deployment, Modal will provide you with an endpoint URL like:
```
https://your-workspace--vllm-h100-serve.modal.run
```

Update your `.env` file in the dex-bench root:

```env
LLM_BASE_URL=https://your-workspace--vllm-h100-serve.modal.run/v1
LLM_API_KEY=your-secret-key
```

## API Endpoints

Each deployment exposes an OpenAI-compatible API:

- `GET /health` - Health check (no auth required)
- `GET /v1/models` - List available models (requires auth)
- `POST /v1/chat/completions` - Chat completions (requires auth)
- `POST /v1/completions` - Text completions (requires auth)

### Authentication

GPU-based endpoints require Bearer token authentication:

```bash
curl https://your-workspace--vllm-h100-serve.modal.run/v1/models \
  -H "Authorization: Bearer your-secret-key"
```

### Chat Completions

```bash
# Specify model in request body
curl https://your-workspace--vllm-h100-serve.modal.run/v1/chat/completions \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gemma-3-12b-it",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'

# Also accepts short model names
curl https://your-workspace--vllm-h100-serve.modal.run/v1/chat/completions \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma-3-12b",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'
```

### Text Completions

```bash
curl https://your-workspace--vllm-h100-serve.modal.run/v1/completions \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma-3-12b",
    "prompt": "The capital of France is",
    "max_tokens": 50
  }'

# With echo (include prompt in response)
curl https://your-workspace--vllm-h100-serve.modal.run/v1/completions \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma-3-12b",
    "prompt": "Once upon a time",
    "max_tokens": 100,
    "echo": true
  }'
```

### Structured Output

The GPU-based endpoints support vLLM v0.12.0 structured outputs API.
See: https://docs.vllm.ai/en/v0.12.0/features/structured_outputs/

Two methods are supported:

1. **`response_format`** (OpenAI-compatible)
2. **`structured_outputs`** (vLLM extra_body)

#### JSON Object Mode

Force the model to output valid JSON:

```bash
curl https://your-workspace--vllm-h100-serve.modal.run/v1/chat/completions \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma-3-12b",
    "messages": [{"role": "user", "content": "List 3 colors as JSON"}],
    "response_format": {"type": "json_object"}
  }'
```

#### JSON Schema Mode

Force the model to output JSON conforming to a specific schema:

```bash
curl https://your-workspace--vllm-h100-serve.modal.run/v1/chat/completions \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma-3-12b",
    "messages": [{"role": "user", "content": "Extract: John is 30 years old and lives in NYC"}],
    "response_format": {
      "type": "json_schema",
      "json_schema": {
        "name": "person",
        "schema": {
          "type": "object",
          "properties": {
            "name": {"type": "string"},
            "age": {"type": "integer"},
            "city": {"type": "string"}
          },
          "required": ["name", "age", "city"]
        }
      }
    }
  }'
```

#### Regex Pattern

Constrain output to match a regex pattern:

```bash
curl https://your-workspace--vllm-h100-serve.modal.run/v1/chat/completions \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma-3-12b",
    "messages": [{"role": "user", "content": "Generate an email for Alan Turing at Enigma"}],
    "structured_outputs": {"regex": "\\w+@\\w+\\.com"}
  }'
```

#### Choice Mode

Force output to be one of the given choices:

```bash
curl https://your-workspace--vllm-h100-serve.modal.run/v1/chat/completions \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma-3-12b",
    "messages": [{"role": "user", "content": "Classify: vLLM is wonderful!"}],
    "structured_outputs": {"choice": ["Positive", "Negative", "Neutral"]}
  }'
```

#### EBNF Grammar

Use an EBNF grammar for complex structured output:

```bash
curl https://your-workspace--vllm-h100-serve.modal.run/v1/chat/completions \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma-3-12b",
    "messages": [{"role": "user", "content": "Generate a SQL query"}],
    "structured_outputs": {"grammar": "root ::= \"SELECT \" column \" FROM \" table\ncolumn ::= \"id\" | \"name\"\ntable ::= \"users\" | \"orders\""}
  }'
```

#### Structured Output with Text Completions

Structured outputs also work with the `/v1/completions` endpoint:

```bash
curl https://your-workspace--vllm-h100-serve.modal.run/v1/completions \
  -H "Authorization: Bearer your-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma-3-12b",
    "prompt": "Generate a person object:",
    "structured_outputs": {
      "json": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "age": {"type": "integer"}
        },
        "required": ["name", "age"]
      }
    }
  }'
```

### List Available Models

```bash
curl https://your-workspace--vllm-h100-serve.modal.run/v1/models \
  -H "Authorization: Bearer your-secret-key"
```

## Cold Starts

- **First request to a model**: ~2-5 minutes (model loading)
- **Subsequent requests**: Fast (while container is warm)
- **Container idle timeout**: 15 minutes (auto-shutdown)

Each model runs in its own container pool, so using multiple models doesn't cause memory conflicts.

## Cost Optimization

- **On-demand scaling**: Servers auto-shutdown after 15 minutes of inactivity
- **Fast boot mode**: Uses `--enforce-eager` for faster cold starts
- **Cached models**: Model weights are cached in Modal Volumes
- **GPU-based deployment**: Use fewer endpoints, still serve all models

## Adding New Models

Edit `config.py` to add new base models:

```python
BASE_MODELS["my-model"] = {
    "name": "org/model-name",           # Name used in API requests
    "huggingface_id": "org/model-id",   # HuggingFace model ID
    "tool_parser": "hermes",            # Optional: tool call parser
}
```

The model will automatically be available on all GPU endpoints.

## Troubleshooting

### Model Download Fails
- Ensure your HuggingFace token has access to the model
- Check that the `huggingface` secret is properly set in Modal

### Out of Memory
- Try a larger GPU (e.g., L40S → A100)
- The GPU-based deployment runs each model in separate containers, so memory is isolated

### Slow Cold Starts
- First request takes 2-5 minutes to load the model
- Subsequent requests are fast while the server is warm
- Consider running periodic health checks to keep servers warm

### Endpoint Limit Exceeded
- Use GPU-based deployment (`--gpu`) instead of model-based (`--model`)
- GPU-based uses only 5 endpoints vs 15 for model-based

### Authentication Failed (401)
- Ensure you created the `vllm-api-key` secret in Modal
- Check that your API key matches the one in the secret
- The `/health` endpoint doesn't require authentication

## Direct Modal Commands

You can also use Modal CLI directly:

```bash
# GPU-based deployment
GPU_KEY=h100 uv run modal deploy vllm_gpu_server.py

# Run test
GPU_KEY=h100 uv run modal run vllm_gpu_server.py --model gemma-3-12b --api-key your-secret-key

# View logs
uv run modal app logs vllm-h100

# Legacy: model-based
MODEL_KEY=gemma-3-12b-l40s uv run modal deploy vllm_server.py
```

## LiteLLM Proxy

A Docker Compose setup is available in the project root to proxy all Modal endpoints through LiteLLM. This provides a unified API endpoint for all deployed models.

### Setup

1. **Find your Modal workspace name**:
   ```bash
   modal config show
   ```

2. **Create `.env` file** in the project root:
   ```env
   MODAL_WORKSPACE=your-workspace-name
   VLLM_API_KEY=your-secret-key
   ```

3. **Start the proxy**:
   ```bash
   docker compose up -d
   ```

4. **Use the proxy** (port 4000):
   ```bash
   # List available models
   curl http://localhost:4000/v1/models

   # Chat completion (model name includes GPU suffix)
   curl http://localhost:4000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gemma-3-12b-h100",
       "messages": [{"role": "user", "content": "Hello!"}]
     }'
   
   # Text completion
   curl http://localhost:4000/v1/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gemma-3-12b-h100",
       "prompt": "The capital of France is",
       "max_tokens": 50
     }'
   
   # With structured output (JSON schema)
   curl http://localhost:4000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gemma-3-12b-h100",
       "messages": [{"role": "user", "content": "Extract: Alice is 25"}],
       "response_format": {
         "type": "json_schema",
         "json_schema": {
           "name": "person",
           "schema": {
             "type": "object",
             "properties": {
               "name": {"type": "string"},
               "age": {"type": "integer"}
             },
             "required": ["name", "age"]
           }
         }
       }
     }'
   
   # With structured output (choice)
   curl http://localhost:4000/v1/chat/completions \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gemma-3-12b-h100",
       "messages": [{"role": "user", "content": "Classify: This is great!"}],
       "structured_outputs": {"choice": ["Positive", "Negative"]}
     }'
   ```

### LiteLLM Model Mapping

LiteLLM routes model requests to the correct GPU endpoint:

| LiteLLM Model | Routes To | Backend Model |
|---------------|-----------|---------------|
| `gemma-3-12b-h100` | `vllm-h100` endpoint | `google/gemma-3-12b-it` |
| `gemma-3-27b-h100` | `vllm-h100` endpoint | `google/gemma-3-27b-it` |
| `qwen3-vl-30b-h100` | `vllm-h100` endpoint | `qwen/qwen3-vl-30b-a3b-instruct` |

All models on the same GPU share one Modal endpoint, reducing from 15 to 5 endpoints.
