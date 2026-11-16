#!/usr/bin/env python3
"""
Zaylo Image Engine — Local Text-to-Image Generation Worker
Executes local diffusion inference using PyTorch and HuggingFace Diffusers.
Streams structured progress, status, and completion events via stdout as JSON Lines.
"""

import sys
import os
import json
import time
import argparse
import signal
import inspect

os.environ["TOKENIZERS_PARALLELISM"] = "false"

interrupted = False

def handle_signal(sig, frame):
    global interrupted
    interrupted = True
    print(json.dumps({"type": "log", "level": "WARN", "message": f"Received termination signal ({sig}). Cleaning up..."}), flush=True)
    sys.exit(0)

signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)

def log_event(data):
    sys.stdout.write("\n" + json.dumps(data) + "\n")
    sys.stdout.flush()

def select_device(preferred="auto"):
    import torch
    if preferred == "cuda" and torch.cuda.is_available():
        return torch.device("cuda")
    if preferred == "mps" and torch.backends.mps.is_available():
        return torch.device("mps")
    if preferred == "cpu":
        return torch.device("cpu")

    # Auto detection
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")

def main():
    parser = argparse.ArgumentParser(description="Zaylo Local Diffusion Image Generation Worker")
    parser.add_argument("--config", type=str, required=True, help="Path to JSON configuration file")
    args = parser.parse_args()

    if not os.path.exists(args.config):
        log_event({"type": "error", "message": f"Config file not found: {args.config}"})
        sys.exit(1)

    with open(args.config, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    model_path = cfg.get("modelPath", "")
    model_id = cfg.get("modelId", "sd-turbo")
    prompt = cfg.get("prompt", "").strip()
    negative_prompt = cfg.get("negativePrompt", "").strip() or None
    width = int(cfg.get("width", 512))
    height = int(cfg.get("height", 512))
    steps = max(1, min(100, int(cfg.get("steps", 20))))
    guidance_scale = float(cfg.get("guidanceScale", 7.5))
    seed = int(cfg.get("seed", int(time.time() * 1000) % 2147483647))
    batch_size = max(1, min(4, int(cfg.get("batchSize", 1))))
    output_dir = cfg.get("outputDir", os.path.expanduser("~/Pictures/Zaylo/Generated"))
    preferred_device = cfg.get("device", "auto")

    os.makedirs(output_dir, exist_ok=True)

    if not prompt:
        log_event({"type": "error", "message": "Prompt cannot be empty."})
        sys.exit(1)

    log_event({
        "type": "status",
        "stage": "initializing",
        "message": f"Initializing image generation for: \"{prompt[:60]}...\""
    })

    try:
        import torch
        from PIL import Image
    except ImportError as e:
        log_event({"type": "error", "message": f"PyTorch or Pillow is missing: {str(e)}"})
        sys.exit(1)

    device = select_device(preferred_device)
    device_str = device.type

    # Precision
    if device.type in ["cuda", "mps"]:
        torch_dtype = torch.float16
    else:
        torch_dtype = torch.float32

    log_event({
        "type": "status",
        "stage": "device_selected",
        "message": f"Using {device_str.upper()} acceleration (precision: {torch_dtype}).",
        "device": device_str
    })

    start_time = time.time()
    generator = torch.Generator(device=device).manual_seed(seed) if device.type != "mps" else torch.Generator("cpu").manual_seed(seed)

    # Check if diffusers is installed
    try:
        import diffusers
        from diffusers import AutoPipelineForText2Image, StableDiffusionPipeline, StableDiffusionXLPipeline
    except ImportError as error:
        log_event({"type": "error", "message": f"Diffusers dependencies are missing: {error}. Install torch, diffusers, transformers, and Pillow in the selected Python environment."})
        sys.exit(1)

    pipe = None
    loaded_successfully = False
    load_errors = []

    # Attempt to load model pipeline
    if diffusers is not None and model_path and os.path.exists(model_path):
        log_event({
            "type": "status",
            "stage": "loading_model",
            "message": f"Loading model weights from {os.path.basename(model_path)}..."
        })
        try:
            if model_path.endswith(".safetensors") or model_path.endswith(".ckpt"):
                pipeline_type = StableDiffusionXLPipeline if "xl" in model_id.lower() else StableDiffusionPipeline
                pipe = pipeline_type.from_single_file(
                    model_path,
                    torch_dtype=torch_dtype,
                    load_safety_checker=False,
                    local_files_only=True,
                )
            elif os.path.isdir(model_path):
                pipe = AutoPipelineForText2Image.from_pretrained(
                    model_path,
                    torch_dtype=torch_dtype,
                    safety_checker=None,
                    local_files_only=True,
                )
            if pipe:
                pipe.to(device)
                # Enable memory optimization if on MPS/CUDA
                if hasattr(pipe, "enable_attention_slicing"):
                    pipe.enable_attention_slicing()
                loaded_successfully = True
        except Exception as load_err:
            load_errors.append(str(load_err))
            log_event({
                "type": "log",
                "level": "WARN",
                "message": f"Could not load weights via from_single_file: {str(load_err)}. Checking cache..."
            })

    # Check Hugging Face hub / local cache if not loaded yet
    if not loaded_successfully and diffusers is not None:
        repo_map = {
            "tiny-sd": "segmind/tiny-sd",
            "sd-turbo": "stabilityai/sd-turbo",
            "dreamshaper-8": "Lykon/dreamshaper-8",
            "stable-diffusion-v1-5": "runwayml/stable-diffusion-v1-5",
        }
        repo_id = repo_map.get(model_id, model_id if ("/" in model_id) else None)
        if repo_id:
            try:
                log_event({
                    "type": "status",
                    "stage": "loading_model",
                    "message": f"Loading model pipeline for {repo_id}..."
                })
                pipe = AutoPipelineForText2Image.from_pretrained(
                    repo_id,
                    torch_dtype=torch_dtype,
                    safety_checker=None,
                    local_files_only=True,
                )
                if pipe:
                    pipe.to(device)
                    if hasattr(pipe, "enable_attention_slicing"):
                        pipe.enable_attention_slicing()
                    loaded_successfully = True
            except Exception as repo_err:
                load_errors.append(str(repo_err))
                log_event({
                    "type": "log",
                    "level": "INFO",
                    "message": f"HuggingFace pipeline lookup: {str(repo_err)}"
                })

    # Step callback function
    step_start_time = time.time()

    def step_callback(pipe_ref, step_index, timestep, callback_kwargs):
        if interrupted:
            raise KeyboardInterrupt("Interrupted by user")
        elapsed = time.time() - start_time
        pct = min(99, int((step_index + 1) / max(1, steps) * 100))
        log_event({
            "type": "progress",
            "step": step_index + 1,
            "totalSteps": steps,
            "percentage": pct,
            "elapsedSeconds": round(elapsed, 2)
        })
        return callback_kwargs

    generated_images = []

    if loaded_successfully and pipe is not None:
        log_event({
            "type": "status",
            "stage": "generating",
            "message": f"Denoising latents ({steps} steps, {width}x{height}, guidance={guidance_scale})..."
        })

        try:
            if hasattr(pipe, "set_progress_bar_config"):
                pipe.set_progress_bar_config(disable=True)

            call_kwargs = {
                "prompt": prompt,
                "width": width,
                "height": height,
                "num_inference_steps": steps,
                "guidance_scale": guidance_scale,
                "generator": generator,
                "num_images_per_prompt": batch_size,
            }
            if negative_prompt and "turbo" not in model_id.lower():
                call_kwargs["negative_prompt"] = negative_prompt

            call_parameters = inspect.signature(pipe.__call__).parameters
            if "callback_on_step_end" in call_parameters:
                call_kwargs["callback_on_step_end"] = step_callback
            elif "callback" in call_parameters:
                call_kwargs["callback"] = lambda s, t, lat: step_callback(pipe, s, t, {})
                call_kwargs["callback_steps"] = 1

            result = pipe(**call_kwargs)
            images_list = result.images
        except Exception as gen_err:
            log_event({"type": "error", "message": f"Diffusion generation failed: {str(gen_err)}"})
            sys.exit(1)
    else:
        detail = "; ".join(load_errors) or f"No usable local model found for {model_id} at {model_path or '(no model path)'}"
        log_event({"type": "error", "message": f"No diffusion pipeline could be loaded: {detail}. Download a supported model and its pipeline dependencies before generating images. Generation does not download missing files."})
        sys.exit(1)

    # Save outputs to disk
    timestamp = int(time.time() * 1000)
    for idx, img in enumerate(images_list):
        img_seed = seed + idx
        filename = f"zaylo_{timestamp}_{img_seed}_{idx + 1}.png"
        filepath = os.path.join(output_dir, filename)
        img.save(filepath, format="PNG")
        file_size = os.path.getsize(filepath)

        generated_images.append({
            "id": f"img_{timestamp}_{idx}",
            "jobId": cfg.get("jobId", f"job_{timestamp}"),
            "localPath": filepath,
            "width": width,
            "height": height,
            "seed": img_seed,
            "prompt": prompt,
            "negativePrompt": negative_prompt or "",
            "steps": steps,
            "guidanceScale": guidance_scale,
            "modelId": model_id,
            "modelName": cfg.get("modelName", model_id),
            "createdAt": timestamp,
            "durationMs": int((time.time() - start_time) * 1000),
            "fileSizeBytes": file_size,
            "device": device_str,
        })

    duration_ms = int((time.time() - start_time) * 1000)

    log_event({
        "type": "completed",
        "images": generated_images,
        "durationMs": duration_ms,
        "device": device_str
    })

if __name__ == "__main__":
    main()
