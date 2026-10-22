#!/usr/bin/env python3
"""
Zaylo Forge — Base vs Fine-Tuned Model Comparator
Runs comparable text generation with identical parameters side by side.
"""

import sys
import os
import json
import time
import argparse
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

os.environ["TOKENIZERS_PARALLELISM"] = "false"

def main():
    parser = argparse.ArgumentParser(description="Forge Model Comparator")
    parser.add_argument("--base-model", type=str, required=True, help="Path to base model directory")
    parser.add_argument("--adapter", type=str, default="", help="Path to fine-tuned LoRA adapter directory")
    parser.add_argument("--prompt", type=str, required=True, help="Input prompt to test")
    parser.add_argument("--temperature", type=float, default=0.7, help="Generation temperature")
    parser.add_argument("--max-tokens", type=int, default=128, help="Max new tokens to generate")
    args = parser.parse_args()

    device = torch.device("cpu")
    torch_dtype = torch.float32

    # 1. Base model generation
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        tokenizer.pad_token_id = tokenizer.eos_token_id

    model = AutoModelForCausalLM.from_pretrained(
        args.base_model,
        torch_dtype=torch_dtype,
        trust_remote_code=True
    ).to(device)
    model.eval()

    formatted_prompt = args.prompt
    if "### Instruction" not in args.prompt and "<|im_start|>" not in args.prompt:
        if hasattr(tokenizer, "apply_chat_template") and tokenizer.chat_template:
            try:
                formatted_prompt = tokenizer.apply_chat_template(
                    [{"role": "user", "content": args.prompt}],
                    tokenize=False,
                    add_generation_prompt=True
                )
            except Exception:
                formatted_prompt = f"### Instruction:\n{args.prompt}\n\n### Response:\n"
        else:
            formatted_prompt = f"### Instruction:\n{args.prompt}\n\n### Response:\n"

    inputs = tokenizer(formatted_prompt, return_tensors="pt").to(device)
    input_length = inputs["input_ids"].shape[1]

    # Generate base
    t0 = time.time()
    with torch.no_grad():
        out_base = model.generate(
            **inputs,
            max_new_tokens=args.max_tokens,
            min_new_tokens=2,
            temperature=max(0.01, args.temperature),
            do_sample=args.temperature > 0.05,
            pad_token_id=tokenizer.pad_token_id
        )
    base_duration_ms = int((time.time() - t0) * 1000)
    base_response = tokenizer.decode(out_base[0][input_length:], skip_special_tokens=True).strip()

    # 2. Fine-tuned model generation
    fine_tuned_response = ""
    ft_duration_ms = 0

    if args.adapter and os.path.exists(args.adapter):
        from peft import PeftModel
        ft_model = PeftModel.from_pretrained(model, args.adapter)
        ft_model.eval()

        t1 = time.time()
        with torch.no_grad():
            out_ft = ft_model.generate(
                **inputs,
                max_new_tokens=args.max_tokens,
                min_new_tokens=2,
                temperature=max(0.01, args.temperature),
                do_sample=args.temperature > 0.05,
                pad_token_id=tokenizer.pad_token_id
            )
        ft_duration_ms = int((time.time() - t1) * 1000)
        fine_tuned_response = tokenizer.decode(out_ft[0][input_length:], skip_special_tokens=True).strip()
    else:
        fine_tuned_response = "[No adapter specified or adapter path not found]"

    result = {
        "prompt": args.prompt,
        "baseResponse": base_response,
        "fineTunedResponse": fine_tuned_response,
        "baseDurationMs": base_duration_ms,
        "fineTunedDurationMs": ft_duration_ms
    }

    print(json.dumps(result))

if __name__ == "__main__":
    main()
