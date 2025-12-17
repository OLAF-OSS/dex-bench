"""
vLLM server deployment on Modal.

This module creates OpenAI-compatible vLLM servers that can be deployed on Modal.
Each model gets its own Modal app with on-demand scaling.

Usage:
    # Deploy a specific model (format: {base-model}-{gpu})
    modal deploy vllm_server.py --env MODEL_KEY=gemma-3-12b-l40s

    # Or use the deploy.py helper script
    python deploy.py --model gemma-3-12b-l40s
"""

import json
import os
import subprocess
from typing import Any

import aiohttp
import modal

from config import GPU_OPTIONS, MODELS, ModelConfig, get_model_config

# Default model key (must include GPU suffix)
DEFAULT_MODEL_KEY = "gemma-3-12b-l40s"

# Get model from environment variable
MODEL_KEY = os.environ.get("MODEL_KEY", DEFAULT_MODEL_KEY)

# Load model configuration
try:
    MODEL_CONFIG: ModelConfig = get_model_config(MODEL_KEY)
except ValueError:
    # Fallback for when config can't be loaded (during image build)
    MODEL_CONFIG = MODELS[DEFAULT_MODEL_KEY]

# Container image with vLLM
vllm_image = (
    modal.Image.from_registry("nvidia/cuda:12.8.1-devel-ubuntu22.04", add_python="3.12")
    .entrypoint([])
    .pip_install(
        "vllm==0.12.0",
        "huggingface_hub[hf_transfer]==0.35.0",
        "flashinfer-python==0.3.1",
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})  # faster model transfers
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


@app.function(
    image=vllm_image,
    gpu=f"{MODEL_CONFIG.gpu}:{MODEL_CONFIG.n_gpu}",
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
    cmd = [
        "vllm",
        "serve",
        MODEL_CONFIG.huggingface_id,
        "--host",
        "0.0.0.0",
        "--port",
        str(VLLM_PORT),
        "--served-model-name",
        MODEL_CONFIG.name,  # Use the dex-bench model name for API compatibility
        "--uvicorn-log-level",
        "info",
    ]

    # Add revision if specified
    if MODEL_CONFIG.revision:
        cmd += ["--revision", MODEL_CONFIG.revision]

    # Add max model length if specified (helps with memory)
    if MODEL_CONFIG.max_model_len:
        cmd += ["--max-model-len", str(MODEL_CONFIG.max_model_len)]

    # Fast boot vs optimized performance
    cmd += ["--enforce-eager"] if FAST_BOOT else ["--no-enforce-eager"]

    # Tensor parallelism for multi-GPU
    cmd += ["--tensor-parallel-size", str(MODEL_CONFIG.n_gpu)]

    # Enable OpenAI-compatible tool calling and structured outputs
    cmd += ["--enable-auto-tool-choice"]

    # Add tool call parser if specified (hermes, mistral, llama3_json, etc.)
    if MODEL_CONFIG.tool_parser:
        cmd += ["--tool-call-parser", MODEL_CONFIG.tool_parser]

    print(f"Starting vLLM server for {MODEL_CONFIG.name}")
    print(f"GPU: {MODEL_CONFIG.gpu} x{MODEL_CONFIG.n_gpu}")
    print(f"Tool parser: {MODEL_CONFIG.tool_parser or 'default'}")
    print(f"Command: {' '.join(cmd)}")

    subprocess.Popen(" ".join(cmd), shell=True)


@app.local_entrypoint()
async def test(timeout: int = 10 * MINUTES):
    """Test the deployed vLLM server with a simple request."""
    url = serve.web_url

    print(f"Testing vLLM server at {url}")
    print(f"Model: {MODEL_CONFIG.name}")

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
            "model": MODEL_CONFIG.name,
            "messages": messages,
            "max_tokens": 50,
            "stream": True,
        }

        print(f"\nSending test request to {MODEL_CONFIG.name}...")
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

