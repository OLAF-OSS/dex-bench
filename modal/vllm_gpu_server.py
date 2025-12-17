"""
GPU-based vLLM server deployment on Modal with multi-model routing.

This module creates a single web endpoint per GPU type that can serve multiple models.
Each model runs in its own container pool using Modal's class-based pattern.

Architecture:
- 5 GPU apps: vllm-l40s, vllm-a100, vllm-h100, vllm-h200, vllm-b200
- 1 web endpoint per app (FastAPI router)
- 3 model classes per app (NOT web endpoints, just Modal functions)
- Requests are routed to the correct model based on the 'model' field

Usage:
    # Deploy a GPU app
    GPU_KEY=h100 modal deploy vllm_gpu_server.py

    # Or use deploy.py helper
    python deploy.py --gpu h100
"""

import os
import sys
import time
from typing import Any

import modal

# Ensure /root is in path for config module in Modal container
if "/root" not in sys.path:
    sys.path.insert(0, "/root")

from config import BASE_MODELS, GPU_SHORT_NAMES

# Get GPU from environment variable
GPU_KEY = os.environ.get("GPU_KEY", "h100")

# Map short names to Modal GPU types
GPU_SHORT_TO_MODAL = {v: k for k, v in GPU_SHORT_NAMES.items()}
GPU_TYPE = GPU_SHORT_TO_MODAL.get(GPU_KEY, "H100")

# Container image with vLLM
vllm_image = (
    modal.Image.from_registry("nvidia/cuda:12.8.1-devel-ubuntu22.04", add_python="3.12")
    .entrypoint([])
    .pip_install(
        "vllm==0.12.0",
        "huggingface_hub[hf_transfer]==0.35.0",
        "flashinfer-python==0.5.3",
        "fastapi[standard]",
        "requests",
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
    .add_local_file("config.py", "/root/config.py")  # Include config module
)

# Modal Volumes for caching
hf_cache_vol = modal.Volume.from_name("huggingface-cache", create_if_missing=True)
vllm_cache_vol = modal.Volume.from_name("vllm-cache", create_if_missing=True)

# Configuration
MINUTES = 60  # seconds

# Create Modal app with GPU-specific name
app = modal.App(f"vllm-{GPU_KEY}")

# Common function configuration
COMMON_CONFIG = {
    "image": vllm_image,
    "gpu": GPU_TYPE,
    "scaledown_window": 15 * MINUTES,
    "timeout": 10 * MINUTES,
    "volumes": {
        "/root/.cache/huggingface": hf_cache_vol,
        "/root/.cache/vllm": vllm_cache_vol,
    },
    "secrets": [modal.Secret.from_name("huggingface", required_keys=["HF_TOKEN"])],
}


# =============================================================================
# Model Classes - Must be defined at global scope for Modal
# =============================================================================


@app.cls(**COMMON_CONFIG)
class Gemma3_12B:
    """vLLM inference class for gemma-3-12b."""
    
    model_key: str = "gemma-3-12b"
    model_name: str = BASE_MODELS["gemma-3-12b"]["name"]
    huggingface_id: str = BASE_MODELS["gemma-3-12b"]["huggingface_id"]
    
    @modal.enter()
    def load_model(self):
        """Load the vLLM engine when container starts."""
        from vllm import LLM
        
        print(f"Loading model: {self.huggingface_id}")
        start = time.time()
        
        self.llm = LLM(
            model=self.huggingface_id,
            enforce_eager=True,
            max_model_len=65536,  # 64K context
            trust_remote_code=True,
        )
        
        elapsed = time.time() - start
        print(f"Model loaded in {elapsed:.1f}s: {self.model_name}")
    
    @modal.method()
    def chat(
        self,
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 1.0,
        response_format: dict | None = None,
        structured_outputs: dict | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """Generate a chat completion with optional structured output."""
        return _generate_chat_completion(
            self.llm, self.model_name, messages, max_tokens, temperature, top_p,
            response_format=response_format,
            structured_outputs=structured_outputs,
        )
    
    @modal.method()
    def complete(
        self,
        prompt: str | list[str],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 1.0,
        echo: bool = False,
        response_format: dict | None = None,
        structured_outputs: dict | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """Generate a text completion with optional structured output."""
        return _generate_text_completion(
            self.llm, self.model_name, prompt, max_tokens, temperature, top_p, echo,
            response_format=response_format,
            structured_outputs=structured_outputs,
        )
    
    @modal.method()
    def health(self) -> dict:
        """Health check."""
        return {"status": "ok", "model": self.model_name}


@app.cls(**COMMON_CONFIG)
class Gemma3_27B:
    """vLLM inference class for gemma-3-27b."""
    
    model_key: str = "gemma-3-27b"
    model_name: str = BASE_MODELS["gemma-3-27b"]["name"]
    huggingface_id: str = BASE_MODELS["gemma-3-27b"]["huggingface_id"]
    
    @modal.enter()
    def load_model(self):
        """Load the vLLM engine when container starts."""
        from vllm import LLM
        
        print(f"Loading model: {self.huggingface_id}")
        start = time.time()
        
        self.llm = LLM(
            model=self.huggingface_id,
            enforce_eager=True,
            max_model_len=65536,  # 64K context
            trust_remote_code=True,
        )
        
        elapsed = time.time() - start
        print(f"Model loaded in {elapsed:.1f}s: {self.model_name}")
    
    @modal.method()
    def chat(
        self,
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 1.0,
        response_format: dict | None = None,
        structured_outputs: dict | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """Generate a chat completion with optional structured output."""
        return _generate_chat_completion(
            self.llm, self.model_name, messages, max_tokens, temperature, top_p,
            response_format=response_format,
            structured_outputs=structured_outputs,
        )
    
    @modal.method()
    def complete(
        self,
        prompt: str | list[str],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 1.0,
        echo: bool = False,
        response_format: dict | None = None,
        structured_outputs: dict | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """Generate a text completion with optional structured output."""
        return _generate_text_completion(
            self.llm, self.model_name, prompt, max_tokens, temperature, top_p, echo,
            response_format=response_format,
            structured_outputs=structured_outputs,
        )
    
    @modal.method()
    def health(self) -> dict:
        """Health check."""
        return {"status": "ok", "model": self.model_name}


@app.cls(**COMMON_CONFIG)
class Qwen3_VL_30B:
    """vLLM inference class for qwen3-vl-30b."""
    
    model_key: str = "qwen3-vl-30b"
    model_name: str = BASE_MODELS["qwen3-vl-30b"]["name"]
    huggingface_id: str = BASE_MODELS["qwen3-vl-30b"]["huggingface_id"]
    
    @modal.enter()
    def load_model(self):
        """Load the vLLM engine when container starts."""
        from vllm import LLM
        
        print(f"Loading model: {self.huggingface_id}")
        start = time.time()
        
        self.llm = LLM(
            model=self.huggingface_id,
            enforce_eager=True,
            max_model_len=65536,  # 64K context
            trust_remote_code=True,
        )
        
        elapsed = time.time() - start
        print(f"Model loaded in {elapsed:.1f}s: {self.model_name}")
    
    @modal.method()
    def chat(
        self,
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 1.0,
        response_format: dict | None = None,
        structured_outputs: dict | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """Generate a chat completion with optional structured output."""
        return _generate_chat_completion(
            self.llm, self.model_name, messages, max_tokens, temperature, top_p,
            response_format=response_format,
            structured_outputs=structured_outputs,
        )
    
    @modal.method()
    def complete(
        self,
        prompt: str | list[str],
        max_tokens: int = 1024,
        temperature: float = 0.7,
        top_p: float = 1.0,
        echo: bool = False,
        response_format: dict | None = None,
        structured_outputs: dict | None = None,
        **kwargs,
    ) -> dict[str, Any]:
        """Generate a text completion with optional structured output."""
        return _generate_text_completion(
            self.llm, self.model_name, prompt, max_tokens, temperature, top_p, echo,
            response_format=response_format,
            structured_outputs=structured_outputs,
        )
    
    @modal.method()
    def health(self) -> dict:
        """Health check."""
        return {"status": "ok", "model": self.model_name}


# Model class registry
MODEL_CLASSES = {
    "gemma-3-12b": Gemma3_12B,
    "gemma-3-27b": Gemma3_27B,
    "qwen3-vl-30b": Qwen3_VL_30B,
}


def _build_structured_outputs_params(
    response_format: dict | None = None,
    structured_outputs: dict | None = None,
):
    """Build vLLM StructuredOutputsParams from OpenAI-compatible request.
    
    Supports vLLM v0.12.0 structured outputs API:
    https://docs.vllm.ai/en/v0.12.0/features/structured_outputs/
    
    Via response_format:
    - {"type": "json_object"} - Force valid JSON output
    - {"type": "json_schema", "json_schema": {"name": "...", "schema": {...}}}
    
    Via structured_outputs (extra_body):
    - {"json": <schema>} - JSON schema as string or dict
    - {"regex": "<pattern>"} - Regex pattern
    - {"choice": ["a", "b"]} - Force one of choices
    - {"grammar": "<ebnf>"} - EBNF grammar
    """
    import json as json_module
    from vllm.sampling_params import StructuredOutputsParams
    
    # Handle response_format (OpenAI-compatible)
    if response_format:
        format_type = response_format.get("type")
        
        if format_type == "json_object":
            # Force valid JSON output
            return StructuredOutputsParams(json_object=True)
        
        elif format_type == "json_schema":
            # Force specific JSON schema
            json_schema = response_format.get("json_schema", {})
            schema = json_schema.get("schema")
            if schema:
                if isinstance(schema, dict):
                    schema = json_module.dumps(schema)
                return StructuredOutputsParams(json=schema)
    
    # Handle structured_outputs (vLLM extra_body)
    if structured_outputs:
        # JSON schema
        if "json" in structured_outputs:
            schema = structured_outputs["json"]
            if isinstance(schema, dict):
                schema = json_module.dumps(schema)
            return StructuredOutputsParams(json=schema)
        
        # Regex pattern
        if "regex" in structured_outputs:
            return StructuredOutputsParams(regex=structured_outputs["regex"])
        
        # Choice - one of options
        if "choice" in structured_outputs:
            return StructuredOutputsParams(choice=structured_outputs["choice"])
        
        # EBNF Grammar
        if "grammar" in structured_outputs:
            return StructuredOutputsParams(grammar=structured_outputs["grammar"])
    
    return None


def _generate_chat_completion(
    llm,
    model_name: str,
    messages: list[dict],
    max_tokens: int,
    temperature: float,
    top_p: float,
    response_format: dict | None = None,
    structured_outputs: dict | None = None,
) -> dict[str, Any]:
    """Generate a chat completion with optional structured output.
    
    Supports vLLM v0.12.0 structured outputs API.
    """
    from vllm import SamplingParams
    
    # Build prompt from messages using chat template
    tokenizer = llm.get_tokenizer()
    prompt = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )
    
    # Build structured outputs params
    so_params = _build_structured_outputs_params(response_format, structured_outputs)
    
    sampling_params = SamplingParams(
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        structured_outputs=so_params,
    )
    
    # Generate
    outputs = llm.generate([prompt], sampling_params)
    output = outputs[0]
    
    text = output.outputs[0].text if output.outputs else ""
    prompt_tokens = len(output.prompt_token_ids) if output.prompt_token_ids else 0
    completion_tokens = len(output.outputs[0].token_ids) if output.outputs and output.outputs[0].token_ids else 0
    
    return {
        "id": f"chatcmpl-{time.time_ns()}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model_name,
        "choices": [{
            "index": 0,
            "message": {
                "role": "assistant",
                "content": text,
            },
            "finish_reason": "stop",
        }],
        "usage": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
        },
    }


def _generate_text_completion(
    llm,
    model_name: str,
    prompt: str | list[str],
    max_tokens: int,
    temperature: float,
    top_p: float,
    echo: bool = False,
    response_format: dict | None = None,
    structured_outputs: dict | None = None,
) -> dict[str, Any]:
    """Generate a text completion (OpenAI /v1/completions API).
    
    Supports vLLM v0.12.0 structured outputs API.
    """
    from vllm import SamplingParams
    
    # Handle single or multiple prompts
    prompts = [prompt] if isinstance(prompt, str) else prompt
    
    # Build structured outputs params
    so_params = _build_structured_outputs_params(response_format, structured_outputs)
    
    sampling_params = SamplingParams(
        max_tokens=max_tokens,
        temperature=temperature,
        top_p=top_p,
        structured_outputs=so_params,
    )
    
    # Generate
    outputs = llm.generate(prompts, sampling_params)
    
    choices = []
    total_prompt_tokens = 0
    total_completion_tokens = 0
    
    for i, output in enumerate(outputs):
        text = output.outputs[0].text if output.outputs else ""
        prompt_tokens = len(output.prompt_token_ids) if output.prompt_token_ids else 0
        completion_tokens = len(output.outputs[0].token_ids) if output.outputs and output.outputs[0].token_ids else 0
        
        total_prompt_tokens += prompt_tokens
        total_completion_tokens += completion_tokens
        
        # If echo is True, prepend the prompt
        if echo:
            original_prompt = prompts[i] if i < len(prompts) else ""
            text = original_prompt + text
        
        choices.append({
            "index": i,
            "text": text,
            "finish_reason": "stop",
            "logprobs": None,
        })
    
    return {
        "id": f"cmpl-{time.time_ns()}",
        "object": "text_completion",
        "created": int(time.time()),
        "model": model_name,
        "choices": choices,
        "usage": {
            "prompt_tokens": total_prompt_tokens,
            "completion_tokens": total_completion_tokens,
            "total_tokens": total_prompt_tokens + total_completion_tokens,
        },
    }


# =============================================================================
# FastAPI Router - Single web endpoint
# =============================================================================


@app.function(
    image=vllm_image,
    scaledown_window=5 * MINUTES,
    secrets=[modal.Secret.from_name("vllm-api-key", required_keys=["API_KEY"])],
)
@modal.asgi_app()
def serve():
    """FastAPI app that routes requests to the appropriate model."""
    from fastapi import FastAPI, HTTPException, Request, Depends
    from fastapi.responses import JSONResponse
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
    
    api = FastAPI(title=f"vLLM Multi-Model Server ({GPU_KEY.upper()})")
    security = HTTPBearer()
    
    # Get API key from environment (set by Modal secret)
    API_KEY = os.environ.get("API_KEY", "")
    
    async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
        """Verify the Bearer token."""
        if not API_KEY:
            return  # No auth if key not configured
        if credentials.credentials != API_KEY:
            raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Model name to class mapping
    MODEL_LOOKUP = {}
    for model_key, model_info in BASE_MODELS.items():
        MODEL_LOOKUP[model_info["name"]] = model_key
        MODEL_LOOKUP[model_key] = model_key
        MODEL_LOOKUP[model_info["name"].split("/")[-1]] = model_key
    
    def get_model_instance(model_name: str):
        """Get a Modal class instance for a model name."""
        model_key = None
        
        # Try exact match
        if model_name in MODEL_LOOKUP:
            model_key = MODEL_LOOKUP[model_name]
        else:
            # Try partial match
            model_lower = model_name.lower()
            for key, mk in MODEL_LOOKUP.items():
                if key.lower() in model_lower or model_lower in key.lower():
                    model_key = mk
                    break
        
        if model_key and model_key in MODEL_CLASSES:
            return MODEL_CLASSES[model_key]()
        return None
    
    @api.get("/health")
    async def health():
        """Health check (no auth required)."""
        return {"status": "ok", "gpu": GPU_KEY, "models": list(BASE_MODELS.keys())}
    
    @api.get("/v1/models", dependencies=[Depends(verify_token)])
    async def list_models():
        """List available models (requires auth)."""
        models = [
            {
                "id": info["name"],
                "object": "model",
                "created": 0,
                "owned_by": "modal",
            }
            for info in BASE_MODELS.values()
        ]
        return {"object": "list", "data": models}
    
    @api.post("/v1/chat/completions", dependencies=[Depends(verify_token)])
    async def chat_completions(request: Request):
        """Chat completions with structured output support (requires auth).
        
        Supports structured output via:
        - response_format: {"type": "json_object"} or {"type": "json_schema", ...}
        - extra_body.structured_outputs: {"json": ...}, {"regex": ...}, {"choice": ...}, {"grammar": ...}
        
        See: https://docs.vllm.ai/en/v0.12.0/features/structured_outputs/
        """
        body = await request.json()
        model_name = body.get("model")
        
        if not model_name:
            raise HTTPException(status_code=400, detail="model field is required")
        
        model = get_model_instance(model_name)
        if not model:
            available = list(BASE_MODELS.keys())
            raise HTTPException(
                status_code=404,
                detail=f"Model '{model_name}' not found. Available: {available}"
            )
        
        messages = body.get("messages", [])
        max_tokens = body.get("max_tokens", 1024)
        temperature = body.get("temperature", 0.7)
        top_p = body.get("top_p", 1.0)
        response_format = body.get("response_format")
        structured_outputs = body.get("structured_outputs")  # vLLM extra_body
        
        try:
            result = model.chat.remote(
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                response_format=response_format,
                structured_outputs=structured_outputs,
            )
            return JSONResponse(result)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    @api.post("/v1/completions", dependencies=[Depends(verify_token)])
    async def text_completions(request: Request):
        """Text completions endpoint (OpenAI /v1/completions API).
        
        Supports structured output via:
        - response_format: {"type": "json_object"} or {"type": "json_schema", ...}
        - structured_outputs: {"json": ...}, {"regex": ...}, {"choice": ...}, {"grammar": ...}
        
        See: https://docs.vllm.ai/en/v0.12.0/features/structured_outputs/
        """
        body = await request.json()
        model_name = body.get("model")
        
        if not model_name:
            raise HTTPException(status_code=400, detail="model field is required")
        
        model = get_model_instance(model_name)
        if not model:
            available = list(BASE_MODELS.keys())
            raise HTTPException(
                status_code=404,
                detail=f"Model '{model_name}' not found. Available: {available}"
            )
        
        prompt = body.get("prompt", "")
        max_tokens = body.get("max_tokens", 1024)
        temperature = body.get("temperature", 0.7)
        top_p = body.get("top_p", 1.0)
        echo = body.get("echo", False)
        response_format = body.get("response_format")
        structured_outputs = body.get("structured_outputs")  # vLLM extra_body
        
        try:
            result = model.complete.remote(
                prompt=prompt,
                max_tokens=max_tokens,
                temperature=temperature,
                top_p=top_p,
                echo=echo,
                response_format=response_format,
                structured_outputs=structured_outputs,
            )
            return JSONResponse(result)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
    
    return api


# =============================================================================
# Test entrypoint
# =============================================================================


@app.local_entrypoint()
def test(model: str = "gemma-3-12b", api_key: str = ""):
    """Test the deployed server with a simple request."""
    import requests
    
    url = serve.web_url
    print(f"Testing vLLM multi-model server at {url}")
    print(f"GPU: {GPU_KEY}")
    print(f"Testing model: {model}")
    
    # Build headers with API key if provided
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
        print(f"Using API key: {api_key[:4]}***")
    
    # Health check (no auth required)
    print("\nRunning health check...")
    resp = requests.get(f"{url}/health")
    print(f"Health: {resp.json()}")
    
    # List models (requires auth)
    print("\nListing models...")
    resp = requests.get(f"{url}/v1/models", headers=headers)
    if resp.status_code == 401:
        print("Error: Unauthorized - API key required or invalid")
        print("Use --api-key flag to provide the API key")
        return
    models = resp.json()
    print(f"Available models: {[m['id'] for m in models['data']]}")
    
    # Test chat completion
    model_name = BASE_MODELS.get(model, {}).get("name", model)
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Say hello in exactly 5 words."},
    ]
    
    print(f"\nSending test request to {model_name}...")
    print("(This may take a few minutes on first request while model loads)")
    
    resp = requests.post(
        f"{url}/v1/chat/completions",
        headers=headers,
        json={
            "model": model_name,
            "messages": messages,
            "max_tokens": 50,
        },
        timeout=600,  # 10 minute timeout for cold start
    )
    
    if resp.status_code == 401:
        print("Error: Unauthorized - API key required or invalid")
        return
    
    if resp.status_code != 200:
        print(f"Error: {resp.text}")
        return
    
    result = resp.json()
    content = result["choices"][0]["message"]["content"]
    print(f"Response: {content}")
    
    print("\n✓ Test completed successfully!")
    print(f"\nEndpoint URL: {url}")
    print(f"Use this as LLM_BASE_URL: {url}/v1")
