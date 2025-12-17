#!/usr/bin/env python3
"""
CLI helper for deploying vLLM models on Modal.

Two deployment modes:
1. GPU-based (recommended): Deploy one app per GPU that serves all models
2. Model-based (legacy): Deploy one app per model+GPU combination

GPU-based mode uses only 5 endpoints (one per GPU) instead of 15.

Usage:
    # List available configurations
    uv run python deploy.py --list

    # Deploy a GPU app (serves ALL models on that GPU)
    uv run python deploy.py --gpu h100
    uv run python deploy.py --gpu l40s

    # Deploy all 5 GPU apps
    uv run python deploy.py --all

    # Test a GPU endpoint with a specific model
    uv run python deploy.py --test-gpu h100 --test-model gemma-3-12b

    # Legacy: Deploy a single model+GPU combination
    uv run python deploy.py --model gemma-3-12b-l40s

    # Get endpoint URL
    uv run python deploy.py --url h100
"""

import argparse
import os
import subprocess
import sys

from config import (
    BASE_MODELS,
    GPU_OPTIONS,
    GPU_SHORT_NAMES,
    MODELS,
    list_models,
    list_gpu_options,
)


def run_modal_command(cmd: list[str], env: dict[str, str] | None = None) -> int:
    """Run a modal command with optional environment variables."""
    full_env = os.environ.copy()
    if env:
        full_env.update(env)

    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, env=full_env)
    return result.returncode


# =============================================================================
# GPU-based deployment (recommended)
# =============================================================================


def deploy_gpu(gpu_key: str) -> int:
    """Deploy a GPU-based multi-model app."""
    gpu_options = list_gpu_options()
    if gpu_key not in gpu_options:
        print(f"Error: Unknown GPU '{gpu_key}'")
        print(f"Available GPUs: {', '.join(gpu_options)}")
        return 1

    print(f"\n{'='*60}")
    print(f"Deploying vllm-{gpu_key} (multi-model server)")
    print(f"  GPU: {gpu_key.upper()}")
    print(f"  Models: {', '.join(BASE_MODELS.keys())}")
    print(f"{'='*60}\n")

    return run_modal_command(
        ["uv", "run", "modal", "deploy", "vllm_gpu_server.py"],
        env={"GPU_KEY": gpu_key},
    )


def deploy_all_gpus() -> int:
    """Deploy all GPU-based apps (5 total)."""
    failed = []
    gpu_options = list_gpu_options()

    for gpu_key in gpu_options:
        result = deploy_gpu(gpu_key)
        if result != 0:
            failed.append(gpu_key)

    if failed:
        print(f"\nFailed to deploy: {', '.join(failed)}")
        return 1

    print(f"\nSuccessfully deployed all {len(gpu_options)} GPU apps!")
    print("Each app serves all models on its GPU type.")
    return 0


def test_gpu(gpu_key: str, model: str = "gemma-3-12b") -> int:
    """Run a test against a GPU-based deployment."""
    gpu_options = list_gpu_options()
    if gpu_key not in gpu_options:
        print(f"Error: Unknown GPU '{gpu_key}'")
        return 1

    if model not in BASE_MODELS:
        print(f"Error: Unknown model '{model}'")
        print(f"Available models: {', '.join(BASE_MODELS.keys())}")
        return 1

    return run_modal_command(
        ["uv", "run", "modal", "run", "vllm_gpu_server.py", "--model", model],
        env={"GPU_KEY": gpu_key},
    )


def get_gpu_url(gpu_key: str) -> int:
    """Print the endpoint URL for a GPU-based deployment."""
    gpu_options = list_gpu_options()
    if gpu_key not in gpu_options:
        print(f"Error: Unknown GPU '{gpu_key}'")
        return 1

    app_name = f"vllm-{gpu_key}"
    print(f"\nEndpoint URL pattern for {gpu_key}:")
    print(f"  https://your-workspace--{app_name}-serve.modal.run")
    print(f"\nFor LLM_BASE_URL in .env:")
    print(f"  LLM_BASE_URL=https://your-workspace--{app_name}-serve.modal.run/v1")
    print("\nReplace 'your-workspace' with your Modal workspace name.")
    print(f"\nAvailable models on this endpoint:")
    for model_key, info in BASE_MODELS.items():
        print(f"  - {info['name']} (or '{model_key}')")
    return 0


# =============================================================================
# Legacy: Model-based deployment (one app per model+GPU)
# =============================================================================


def deploy_model(model_key: str) -> int:
    """Deploy a single model to Modal (legacy mode)."""
    if model_key not in MODELS:
        print(f"Error: Unknown model '{model_key}'")
        print(f"Available models: {', '.join(list_models())}")
        return 1

    config = MODELS[model_key]
    print(f"\n{'='*60}")
    print(f"Deploying {model_key} (legacy single-model mode)")
    print(f"  HuggingFace ID: {config.huggingface_id}")
    print(f"  GPU: {config.gpu} x{config.n_gpu}")
    print(f"{'='*60}\n")

    return run_modal_command(
        ["uv", "run", "modal", "deploy", "vllm_server.py"],
        env={"MODEL_KEY": model_key},
    )


def test_model(model_key: str) -> int:
    """Run a test against a deployed model (legacy mode)."""
    if model_key not in MODELS:
        print(f"Error: Unknown model '{model_key}'")
        return 1

    return run_modal_command(
        ["uv", "run", "modal", "run", "vllm_server.py"],
        env={"MODEL_KEY": model_key},
    )


def get_model_url(model_key: str) -> int:
    """Print the endpoint URL for a deployed model (legacy mode)."""
    if model_key not in MODELS:
        print(f"Error: Unknown model '{model_key}'")
        return 1

    app_name = f"vllm-{model_key}"
    print(f"\nEndpoint URL pattern for {model_key}:")
    print(f"  https://your-workspace--{app_name}-serve.modal.run")
    print(f"\nFor LLM_BASE_URL in .env:")
    print(f"  LLM_BASE_URL=https://your-workspace--{app_name}-serve.modal.run/v1")
    print("\nReplace 'your-workspace' with your Modal workspace name.")
    return 0


# =============================================================================
# Listing and help
# =============================================================================


def list_available() -> int:
    """List all available configurations."""
    print("\n" + "=" * 60)
    print("GPU-BASED DEPLOYMENT (Recommended)")
    print("=" * 60)
    print("\nDeploy one app per GPU that serves ALL models:")
    print(f"  GPUs: {', '.join(list_gpu_options())}")
    print(f"  Models per GPU: {', '.join(BASE_MODELS.keys())}")
    print(f"  Total endpoints: {len(list_gpu_options())} (under 8 limit)")

    print("\nUsage:")
    print("  uv run python deploy.py --gpu h100      # Deploy H100 app")
    print("  uv run python deploy.py --all           # Deploy all 5 GPU apps")
    print("  uv run python deploy.py --test-gpu h100 # Test H100 with gemma-3-12b")

    print("\n" + "=" * 60)
    print("LEGACY: MODEL-BASED DEPLOYMENT")
    print("=" * 60)
    print("\nDeploy one app per model+GPU combination:")

    # Print matrix
    gpu_headers = [GPU_SHORT_NAMES[g] for g in GPU_OPTIONS]
    print(f"\n{'Base Model':<15} | {' | '.join(f'{g:^8}' for g in gpu_headers)}")
    print("-" * 15 + "-+-" + "-+-".join("-" * 8 for _ in GPU_OPTIONS))

    for base_model in BASE_MODELS.keys():
        row = [base_model]
        for gpu in GPU_OPTIONS:
            gpu_short = GPU_SHORT_NAMES[gpu]
            config_key = f"{base_model}-{gpu_short}"
            row.append("✓" if config_key in MODELS else "-")
        print(f"{row[0]:<15} | {' | '.join(f'{r:^8}' for r in row[1:])}")

    print(f"\nTotal configurations: {len(MODELS)} (exceeds 8 endpoint limit!)")
    print("\nUsage (legacy):")
    print("  uv run python deploy.py --model gemma-3-12b-l40s")

    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Deploy vLLM models on Modal",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
GPU-based deployment (recommended - uses 5 endpoints):
  uv run python deploy.py --gpu h100           Deploy H100 multi-model app
  uv run python deploy.py --all                Deploy all 5 GPU apps
  uv run python deploy.py --test-gpu h100      Test H100 endpoint
  uv run python deploy.py --url h100           Get H100 endpoint URL

Legacy model-based deployment (uses 15 endpoints - exceeds limit):
  uv run python deploy.py --model gemma-3-12b-l40s
  uv run python deploy.py --test gemma-3-12b-l40s
        """,
    )

    group = parser.add_mutually_exclusive_group(required=True)

    # GPU-based commands
    group.add_argument(
        "--gpu",
        "-g",
        type=str,
        help="Deploy a GPU-based multi-model app (l40s, a100, h100, h200, b200)",
    )
    group.add_argument(
        "--all",
        "-a",
        action="store_true",
        help="Deploy all 5 GPU apps",
    )
    group.add_argument(
        "--test-gpu",
        type=str,
        help="Test a GPU-based deployment",
    )
    group.add_argument(
        "--url",
        "-u",
        type=str,
        help="Get endpoint URL for a GPU app or model",
    )
    group.add_argument(
        "--list",
        "-l",
        action="store_true",
        help="List all available configurations",
    )

    # Legacy model-based commands
    group.add_argument(
        "--model",
        "-m",
        type=str,
        help="[Legacy] Deploy a single model+GPU combination",
    )
    group.add_argument(
        "--test",
        "-t",
        type=str,
        help="[Legacy] Test a single model deployment",
    )

    # Additional arguments
    parser.add_argument(
        "--test-model",
        type=str,
        default="gemma-3-12b",
        help="Model to test with --test-gpu (default: gemma-3-12b)",
    )

    args = parser.parse_args()

    if args.list:
        return list_available()
    elif args.gpu:
        return deploy_gpu(args.gpu)
    elif args.all:
        return deploy_all_gpus()
    elif args.test_gpu:
        return test_gpu(args.test_gpu, args.test_model)
    elif args.url:
        # Check if it's a GPU key or model key
        if args.url in list_gpu_options():
            return get_gpu_url(args.url)
        elif args.url in MODELS:
            return get_model_url(args.url)
        else:
            print(f"Error: '{args.url}' is not a valid GPU or model key")
            return 1
    elif args.model:
        return deploy_model(args.model)
    elif args.test:
        return test_model(args.test)

    return 0


if __name__ == "__main__":
    sys.exit(main())
