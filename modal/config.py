"""
Model configurations for vLLM deployments on Modal.

Each model is mapped to:
- huggingface_id: The HuggingFace model identifier
- gpu: The recommended GPU type for this model
- n_gpu: Number of GPUs (for tensor parallelism)
- max_model_len: Maximum context length (optional, for memory optimization)
"""

from dataclasses import dataclass


@dataclass
class ModelConfig:
    """Configuration for a vLLM model deployment."""

    name: str  # Short name used in dex-bench (e.g., "google/gemma-3-12b-it")
    huggingface_id: str  # HuggingFace model ID
    gpu: str  # Modal GPU type
    n_gpu: int = 1  # Number of GPUs for tensor parallelism
    max_model_len: int | None = None  # Max context length (None = use model default)
    revision: str | None = None  # Specific model revision/commit
    tool_parser: str | None = None  # Tool call parser (hermes, mistral, llama3_json, etc.)


# GPU types available on Modal:
# - "L40S" (48GB) - Good for 12B models
# - "A100-80GB" (80GB) - Good for 27B models
# - "H100" (80GB) - Fastest, good for 30B+ models
# - "H200" (141GB) - Very large models
# - "B200" (192GB) - Largest models

GPU_OPTIONS = ["L40S", "A100-80GB", "H100", "H200", "B200"]

# Base model definitions
# tool_parser options: hermes, mistral, llama3_json, internlm, jamba, pythonic, granite-20b-fc, granite, etc.
BASE_MODELS = {
    "gemma-3-12b": {
        "name": "google/gemma-3-12b-it",
        "huggingface_id": "google/gemma-3-12b-it",
        "tool_parser": "hermes",  # Gemma uses Hermes-style tool calling
    },
    "gemma-3-27b": {
        "name": "google/gemma-3-27b-it",
        "huggingface_id": "google/gemma-3-27b-it",
        "tool_parser": "hermes",
    },
    "qwen3-vl-30b": {
        "name": "qwen/qwen3-vl-30b-a3b-instruct",
        "huggingface_id": "Qwen/Qwen3-VL-30B-A3B-Instruct",
        "tool_parser": "hermes",
    },
}

# GPU short names for config keys
GPU_SHORT_NAMES = {
    "L40S": "l40s",
    "A100-80GB": "a100",
    "H100": "h100",
    "H200": "h200",
    "B200": "b200",
}

# Reverse mapping: short name to Modal GPU type
GPU_SHORT_TO_MODAL = {v: k for k, v in GPU_SHORT_NAMES.items()}


def get_gpu_type(gpu_short: str) -> str:
    """Get Modal GPU type from short name."""
    if gpu_short not in GPU_SHORT_TO_MODAL:
        available = ", ".join(GPU_SHORT_TO_MODAL.keys())
        raise ValueError(f"Unknown GPU: {gpu_short}. Available: {available}")
    return GPU_SHORT_TO_MODAL[gpu_short]


def list_gpu_options() -> list[str]:
    """List all available GPU short names."""
    return list(GPU_SHORT_NAMES.values())


def get_base_model_info(model_key: str) -> dict:
    """Get base model info by key (without GPU suffix)."""
    if model_key not in BASE_MODELS:
        available = ", ".join(BASE_MODELS.keys())
        raise ValueError(f"Unknown base model: {model_key}. Available: {available}")
    return BASE_MODELS[model_key]


def _generate_all_configs() -> dict[str, ModelConfig]:
    """Generate all model+GPU combinations."""
    configs: dict[str, ModelConfig] = {}

    for model_key, model_info in BASE_MODELS.items():
        for gpu in GPU_OPTIONS:
            gpu_short = GPU_SHORT_NAMES[gpu]
            config_key = f"{model_key}-{gpu_short}"

            configs[config_key] = ModelConfig(
                name=model_info["name"],
                huggingface_id=model_info["huggingface_id"],
                gpu=gpu,
                n_gpu=2,  # Use 2 GPUs for tensor parallelism
                tool_parser=model_info.get("tool_parser"),
            )

    return configs


# All model configurations (model x GPU combinations)
MODELS: dict[str, ModelConfig] = _generate_all_configs()


def get_model_config(model_key: str) -> ModelConfig:
    """Get model configuration by key."""
    if model_key not in MODELS:
        available = ", ".join(sorted(MODELS.keys()))
        raise ValueError(f"Unknown model: {model_key}. Available: {available}")
    return MODELS[model_key]


def list_models() -> list[str]:
    """List all available model keys."""
    return sorted(MODELS.keys())


def list_models_by_gpu(gpu: str) -> list[str]:
    """List all model keys for a specific GPU."""
    gpu_short = GPU_SHORT_NAMES.get(gpu, gpu.lower())
    return [k for k in sorted(MODELS.keys()) if k.endswith(f"-{gpu_short}")]


def list_models_by_base(base_model: str) -> list[str]:
    """List all GPU variants for a specific base model."""
    return [k for k in sorted(MODELS.keys()) if k.startswith(f"{base_model}-")]
