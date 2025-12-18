"""
vLLM server deployment on Modal.

This module creates OpenAI-compatible vLLM servers that can be deployed on Modal.
Each model gets its own Modal app with on-demand scaling.

Usage:
    # Deploy a specific model (format: {base-model}-{gpu})
    MODEL_KEY=gemma-3-12b-l40s modal deploy vllm_server.py

    # Or use the deploy.py helper script
    python deploy.py --model gemma-3-12b-l40s
"""

import json
import os
import subprocess
import sys
from typing import Any

import aiohttp
import modal

# Ensure /root is in path for config module in Modal container
if "/root" not in sys.path:
    sys.path.insert(0, "/root")

from config import GPU_OPTIONS, MODELS, ModelConfig, get_model_config

# Default model key (must include GPU suffix)
DEFAULT_MODEL_KEY = "gemma-3-12b-l40s"

# Get model from environment variable (used for app naming and local testing)
MODEL_KEY = os.environ.get("MODEL_KEY", DEFAULT_MODEL_KEY)


def _get_runtime_config() -> ModelConfig:
    """Get model config at runtime, with fallback to default."""
    key = os.environ.get("MODEL_KEY", DEFAULT_MODEL_KEY)
    try:
        return get_model_config(key)
    except ValueError:
        return MODELS[DEFAULT_MODEL_KEY]

# Container image with vLLM
# Note: MODEL_KEY is baked into the image via .env() so the container knows which model to load
vllm_image = (
    modal.Image.from_registry("nvidia/cuda:12.8.1-devel-ubuntu22.04", add_python="3.12")
    .entrypoint([])
    .pip_install(
        "vllm==0.12.0",
        "huggingface_hub[hf_transfer]==0.35.0",
        "flashinfer-python==0.5.3",
    )
    .env({
        "HF_HUB_ENABLE_HF_TRANSFER": "1",  # faster model transfers
        "MODEL_KEY": MODEL_KEY,  # Bake model key into container
    })
    .add_local_file("config.py", "/root/config.py")  # Include config module
)

# Modal Volumes for caching
hf_cache_vol = modal.Volume.from_name("huggingface-cache", create_if_missing=True)
vllm_cache_vol = modal.Volume.from_name("vllm-cache", create_if_missing=True)

# Configuration
FAST_BOOT = True  # Use --enforce-eager for faster cold starts
MINUTES = 60  # seconds
VLLM_PORT = 8000

# Create Modal app with model-specific name
app = modal.App(f"vllm-{MODEL_KEY}")


# Get config for decorator (evaluated at deploy time with MODEL_KEY from env)
_deploy_config = _get_runtime_config()


@app.function(
    image=vllm_image,
    gpu=f"{_deploy_config.gpu}:{_deploy_config.n_gpu}",
    scaledown_window=15 * MINUTES,  # Auto-shutdown after 15 minutes idle
    timeout=10 * MINUTES,  # Container start timeout
    volumes={
        "/root/.cache/huggingface": hf_cache_vol,
        "/root/.cache/vllm": vllm_cache_vol,
    },
    secrets=[modal.Secret.from_name("huggingface", required_keys=["HF_TOKEN"])],
)
@modal.concurrent(max_inputs=32)  # Handle multiple concurrent requests
@modal.web_server(port=VLLM_PORT, startup_timeout=10 * MINUTES)
def serve():
    """Start the vLLM server with OpenAI-compatible API."""
    # Get config at runtime from environment (baked into image)
    config = _get_runtime_config()
    
    cmd = [
        "vllm",
        "serve",
        config.huggingface_id,
        "--host",
        "0.0.0.0",
        "--port",
        str(VLLM_PORT),
        "--served-model-name",
        config.name,  # Use the dex-bench model name for API compatibility
        "--uvicorn-log-level",
        "info",
    ]

    # Add revision if specified
    if config.revision:
        cmd += ["--revision", config.revision]

    # Add max model length if specified (helps with memory)
    if config.max_model_len:
        cmd += ["--max-model-len", str(config.max_model_len)]

    # Fast boot vs optimized performance
    cmd += ["--enforce-eager"] if FAST_BOOT else ["--no-enforce-eager"]

    # Tensor parallelism for multi-GPU
    cmd += ["--tensor-parallel-size", str(config.n_gpu)]

    # Enable OpenAI-compatible tool calling and structured outputs
    cmd += ["--enable-auto-tool-choice"]

    # Add tool call parser if specified (hermes, mistral, llama3_json, etc.)
    if config.tool_parser:
        cmd += ["--tool-call-parser", config.tool_parser]

    print(f"Starting vLLM server for {config.name}")
    print(f"MODEL_KEY from env: {os.environ.get('MODEL_KEY', 'NOT SET')}")
    print(f"GPU: {config.gpu} x{config.n_gpu}")
    print(f"Tool parser: {config.tool_parser or 'default'}")
    print(f"Command: {' '.join(cmd)}")

    subprocess.Popen(" ".join(cmd), shell=True)


@app.local_entrypoint()
async def test(timeout: int = 10 * MINUTES):
    """Test the deployed vLLM server with a simple request."""
    url = serve.web_url
    config = _get_runtime_config()

    print(f"Testing vLLM server at {url}")
    print(f"Model: {config.name}")
    print(f"MODEL_KEY: {MODEL_KEY}")

    # Health check
    async with aiohttp.ClientSession(base_url=url) as session:
        print("Running health check...")
        async with session.get("/health", timeout=timeout - MINUTES) as resp:
            if resp.status != 200:
                print(f"Health check failed with status {resp.status}")
                return
        print("Health check passed!")

        # Test chat completion
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Say hello in exactly 5 words."},
        ]

        payload: dict[str, Any] = {
            "model": config.name,
            "messages": messages,
            "max_tokens": 50,
            "stream": True,
        }

        print(f"\nSending test request to {config.name}...")
        print(f"Messages: {messages}")
        print("\nResponse: ", end="")

        async with session.post(
            "/v1/chat/completions",
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Accept": "text/event-stream",
            },
            timeout=MINUTES,
        ) as resp:
            async for raw in resp.content:
                line = raw.decode().strip()
                if not line or line == "data: [DONE]":
                    continue
                if line.startswith("data: "):
                    line = line[len("data: ") :]
                try:
                    chunk = json.loads(line)
                    if chunk.get("object") == "chat.completion.chunk":
                        content = chunk["choices"][0]["delta"].get("content", "")
                        print(content, end="", flush=True)
                except json.JSONDecodeError:
                    pass

        print("\n\nTest completed successfully!")
        print(f"\nEndpoint URL: {url}")
        print(f"Use this as LLM_BASE_URL: {url}/v1")

