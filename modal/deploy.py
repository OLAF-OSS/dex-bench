#!/usr/bin/env python3
"""
CLI helper for deploying vLLM models on Modal.

Model keys use the format: {base-model}-{gpu}
Examples: gemma-3-12b-l40s, gemma-3-27b-h100, qwen3-vl-30b-b200

Usage:
    # List available model configurations
    uv run python deploy.py --list

    # Deploy a single model on specific GPU
    uv run python deploy.py --model gemma-3-12b-l40s
    uv run python deploy.py --model gemma-3-27b-h100

    # Deploy all model+GPU configurations (15 total)
    uv run python deploy.py --all

    # Run a test against a deployed model
    uv run python deploy.py --test gemma-3-12b-l40s

    # Get endpoint URL for a model
    uv run python deploy.py --url gemma-3-12b-l40s
"""

import argparse
import os
import subprocess
import sys

from config import BASE_MODELS, GPU_OPTIONS, GPU_SHORT_NAMES, MODELS, list_models


def run_modal_command(cmd: list[str], env: dict[str, str] | None = None) -> int:
    """Run a modal command with optional environment variables."""
    full_env = os.environ.copy()
    if env:
        full_env.update(env)

    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, env=full_env)
    return result.returncode


def deploy_model(model_key: str) -> int:
    """Deploy a single model to Modal."""
    if model_key not in MODELS:
        print(f"Error: Unknown model '{model_key}'")
        print(f"Available models: {', '.join(list_models())}")
        return 1

    config = MODELS[model_key]
    print(f"\n{'='*60}")
    print(f"Deploying {model_key}")
    print(f"  HuggingFace ID: {config.huggingface_id}")
    print(f"  GPU: {config.gpu} x{config.n_gpu}")
    print(f"{'='*60}\n")

    return run_modal_command(
        ["uv", "run", "modal", "deploy", "vllm_server.py"],
        env={"MODEL_KEY": model_key},
    )


def deploy_all() -> int:
    """Deploy all configured models."""
    failed = []
    for model_key in list_models():
        result = deploy_model(model_key)
        if result != 0:
            failed.append(model_key)

    if failed:
        print(f"\nFailed to deploy: {', '.join(failed)}")
        return 1

    print(f"\nSuccessfully deployed all {len(MODELS)} models!")
    return 0


def test_model(model_key: str) -> int:
    """Run a test against a deployed model."""
    if model_key not in MODELS:
        print(f"Error: Unknown model '{model_key}'")
        return 1

    return run_modal_command(
        ["uv", "run", "modal", "run", "vllm_server.py"],
        env={"MODEL_KEY": model_key},
    )


def get_url(model_key: str) -> int:
    """Print the endpoint URL for a deployed model."""
    if model_key not in MODELS:
        print(f"Error: Unknown model '{model_key}'")
        return 1

    # The URL pattern for Modal web endpoints
    # Note: User needs to replace 'your-workspace' with their actual workspace name
    app_name = f"vllm-{model_key}"
    print(f"\nEndpoint URL pattern for {model_key}:")
    print(f"  https://your-workspace--{app_name}-serve.modal.run")
    print(f"\nFor LLM_BASE_URL in .env:")
    print(f"  LLM_BASE_URL=https://your-workspace--{app_name}-serve.modal.run/v1")
    print("\nReplace 'your-workspace' with your Modal workspace name.")
    print("You can find the exact URL in the Modal dashboard after deployment.")
    return 0


def list_available_models() -> int:
    """List all available models and their configurations."""
    print("\nAvailable model configurations (model x GPU):\n")

    # Print header
    gpu_headers = [GPU_SHORT_NAMES[g] for g in GPU_OPTIONS]
    print(f"{'Base Model':<15} | {' | '.join(f'{g:^8}' for g in gpu_headers)}")
    print("-" * 15 + "-+-" + "-+-".join("-" * 8 for _ in GPU_OPTIONS))

    # Print each base model row
    for base_model in BASE_MODELS.keys():
        row = [base_model]
        for gpu in GPU_OPTIONS:
            gpu_short = GPU_SHORT_NAMES[gpu]
            config_key = f"{base_model}-{gpu_short}"
            row.append("✓" if config_key in MODELS else "-")
        print(f"{row[0]:<15} | {' | '.join(f'{r:^8}' for r in row[1:])}")

    print(f"\nTotal configurations: {len(MODELS)}")
    print(f"Base models: {', '.join(BASE_MODELS.keys())}")
    print(f"GPU options: {', '.join(GPU_OPTIONS)}")

    print("\nUsage examples:")
    print("  uv run python deploy.py --model gemma-3-12b-l40s   # Deploy on L40S")
    print("  uv run python deploy.py --model gemma-3-12b-h100   # Deploy on H100")
    print("  uv run python deploy.py --all                      # Deploy ALL configs")
    print("  uv run python deploy.py --test gemma-3-12b-l40s    # Test deployed model")
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="Deploy vLLM models on Modal",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Model keys use format: {base-model}-{gpu}
  Base models: gemma-3-12b, gemma-3-27b, qwen3-vl-30b
  GPU options: l40s, a100, h100, h200, b200

Examples:
  uv run python deploy.py --list                    List all configurations
  uv run python deploy.py --model gemma-3-12b-l40s  Deploy on L40S
  uv run python deploy.py --model gemma-3-27b-h100  Deploy on H100
  uv run python deploy.py --all                     Deploy all 15 configs
  uv run python deploy.py --test gemma-3-12b-l40s   Test deployed model
  uv run python deploy.py --url gemma-3-12b-l40s    Get endpoint URL
        """,
    )

    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--model",
        "-m",
        type=str,
        help="Deploy a specific model by key",
    )
    group.add_argument(
        "--all",
        "-a",
        action="store_true",
        help="Deploy all configured models",
    )
    group.add_argument(
        "--test",
        "-t",
        type=str,
        help="Run a test against a deployed model",
    )
    group.add_argument(
        "--url",
        "-u",
        type=str,
        help="Get the endpoint URL for a deployed model",
    )
    group.add_argument(
        "--list",
        "-l",
        action="store_true",
        help="List all available models",
    )

    args = parser.parse_args()

    if args.list:
        return list_available_models()
    elif args.model:
        return deploy_model(args.model)
    elif args.all:
        return deploy_all()
    elif args.test:
        return test_model(args.test)
    elif args.url:
        return get_url(args.url)

    return 0


if __name__ == "__main__":
    sys.exit(main())

