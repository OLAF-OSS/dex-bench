# Modal vLLM Deployments

Deploy OpenAI-compatible vLLM servers on Modal.com with on-demand GPU scaling.

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

## Available Models

Each model can be deployed on any GPU, using the format `{model}-{gpu}`:

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

**Example config keys:** `gemma-3-12b-l40s`, `gemma-3-27b-h100`, `qwen3-vl-30b-b200`

**Total configurations:** 15 (3 models × 5 GPUs)

## Deployment

### List Available Models

```bash
uv run python deploy.py --list
```

### Deploy a Single Model

```bash
uv run python deploy.py --model gemma-3-12b-l40s
uv run python deploy.py --model gemma-3-27b-h100
```

### Deploy All Models

```bash
uv run python deploy.py --all
```

### Test a Deployed Model

```bash
uv run python deploy.py --test gemma-3-12b-l40s
```

### Get Endpoint URL

```bash
uv run python deploy.py --url gemma-3-12b-l40s
```

## Using with dex-bench

After deployment, Modal will provide you with an endpoint URL like:
```
https://your-workspace--vllm-gemma-3-12b-l40s-serve.modal.run
```

Update your `.env` file in the dex-bench root:

```env
LLM_BASE_URL=https://your-workspace--vllm-gemma-3-12b-l40s-serve.modal.run/v1
LLM_API_KEY=not-required
```

## API Endpoints

Each deployment exposes an OpenAI-compatible API:

- `GET /health` - Health check
- `GET /v1/models` - List available models
- `POST /v1/chat/completions` - Chat completions
- `POST /v1/completions` - Text completions

### Example Request

```bash
curl https://your-workspace--vllm-gemma-3-12b-serve.modal.run/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gemma-3-12b-it",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 100
  }'
```

## Cost Optimization

- **On-demand scaling**: Servers auto-shutdown after 15 minutes of inactivity
- **Fast boot mode**: Uses `--enforce-eager` for faster cold starts (~2-3 min)
- **Cached models**: Model weights are cached in Modal Volumes

## Adding New Models

Edit `config.py` to add new model configurations:

```python
MODELS["my-model"] = ModelConfig(
    name="org/model-name",           # Name used in API requests
    huggingface_id="org/model-id",   # HuggingFace model ID
    gpu="H100",                      # GPU type
    n_gpu=1,                         # Number of GPUs
    max_model_len=8192,              # Optional: max context length
)
```

Available GPU options: `L40S`, `A100-80GB`, `H100`, `H200`, `B200`

## Troubleshooting

### Model Download Fails
- Ensure your HuggingFace token has access to the model
- Check that the `huggingface` secret is properly set in Modal

### Out of Memory
- Try a larger GPU (e.g., A100-80GB → H100)
- Set `max_model_len` to limit context size
- Use a quantized model variant (FP8, AWQ, GPTQ)

### Slow Cold Starts
- First request takes 2-5 minutes to load the model
- Subsequent requests are fast while the server is warm
- Consider running periodic health checks to keep servers warm

## Direct Modal Commands

You can also use Modal CLI directly via `uv run`:

```bash
# Deploy with specific model+GPU config
MODEL_KEY=gemma-3-12b-l40s uv run modal deploy vllm_server.py

# Run test
MODEL_KEY=gemma-3-12b-l40s uv run modal run vllm_server.py

# View logs
uv run modal app logs vllm-gemma-3-12b-l40s
```

