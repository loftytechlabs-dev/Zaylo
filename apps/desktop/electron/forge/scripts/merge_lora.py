#!/usr/bin/env python3
"""
Zaylo Forge — LoRA Adapter Merger
Safely merges trained LoRA adapter weights back into base model Safetensors weights.
Never overwrites original model files.
"""

import sys
import os
import json
import argparse
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import PeftModel

os.environ["TOKENIZERS_PARALLELISM"] = "false"

def main():
    parser = argparse.ArgumentParser(description="Forge LoRA Merger")
    parser.add_argument("--base-model", type=str, required=True, help="Base model directory")
    parser.add_argument("--adapter", type=str, required=True, help="LoRA adapter directory")
    parser.add_argument("--output-dir", type=str, required=True, help="Destination directory for merged model")
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    device = torch.device("cpu")

    print(json.dumps({"type": "log", "message": f"Loading base model from {args.base_model}..."}), flush=True)
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True)
    base_model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        torch_dtype=torch.float32,
        trust_remote_code=True
    ).to(device)

    print(json.dumps({"type": "log", "message": f"Applying LoRA adapter from {args.adapter}..."}), flush=True)
    peft_model = PeftModel.from_pretrained(base_model, args.adapter)

    print(json.dumps({"type": "log", "message": "Merging LoRA weights into base model layers..."}), flush=True)
    merged_model = peft_model.merge_and_unload()

    print(json.dumps({"type": "log", "message": f"Saving merged Safetensors model to {args.output_dir}..."}), flush=True)
    merged_model.save_pretrained(args.output_dir, safe_serialization=True)
    tokenizer.save_pretrained(args.output_dir)

    total_size = 0
    for dirpath, dirnames, filenames in os.walk(args.output_dir):
        for f in filenames:
            total_size += os.path.getsize(os.path.join(dirpath, f))

    print(json.dumps({
        "success": True,
        "outputPath": args.output_dir,
        "sizeBytes": total_size
    }), flush=True)

if __name__ == "__main__":
    main()
