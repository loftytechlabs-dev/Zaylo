#!/usr/bin/env python3
"""
Zaylo Forge — Local LoRA Fine-Tuning Engine
Executes real local parameter-efficient fine-tuning using PyTorch, Transformers, and PEFT.
Streams structured metrics and logs via stdout as JSON Lines.
"""

import sys
import os
import json
import time
import math
import signal
import argparse
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False
import torch
from torch.utils.data import Dataset, DataLoader

# Disable parallelism warnings from tokenizers
os.environ["TOKENIZERS_PARALLELISM"] = "false"

interrupted = False

def handle_signal(sig, frame):
    global interrupted
    interrupted = True
    print(json.dumps({"type": "log", "level": "WARN", "message": f"Received termination signal ({sig}). Finalizing checkpoint..."}), flush=True)

signal.signal(signal.SIGINT, handle_signal)
signal.signal(signal.SIGTERM, handle_signal)

class InstructionDataset(Dataset):
    def __init__(self, records, tokenizer, max_seq_length=512, objective="instruction", column_mapping=None):
        self.examples = []
        eos_token = tokenizer.eos_token or "<|im_end|>"
        pad_token_id = tokenizer.pad_token_id if tokenizer.pad_token_id is not None else tokenizer.eos_token_id
        column_mapping = column_mapping or {}

        prompt_col = column_mapping.get("promptColumn") or column_mapping.get("prompt_column")
        resp_col = column_mapping.get("responseColumn") or column_mapping.get("response_column")
        inp_col = column_mapping.get("inputColumn") or column_mapping.get("input_column")
        sys_col = column_mapping.get("systemColumn") or column_mapping.get("system_column")

        for rec in records:
            if not isinstance(rec, dict):
                continue

            prompt_text = ""
            response_text = ""

            # 1. User-specified column mapping
            if prompt_col and resp_col and prompt_col in rec and resp_col in rec:
                instruction = str(rec.get(prompt_col, "")).strip()
                inp = str(rec.get(inp_col, "")).strip() if inp_col and inp_col in rec else ""
                sys_msg = str(rec.get(sys_col, "")).strip() if sys_col and sys_col in rec else ""
                out = str(rec.get(resp_col, "")).strip()

                if sys_msg:
                    prompt_text = f"### System:\n{sys_msg}\n\n### Instruction:\n{instruction}"
                else:
                    prompt_text = f"### Instruction:\n{instruction}"

                if inp:
                    prompt_text += f"\n\n### Input:\n{inp}\n\n### Response:\n"
                else:
                    prompt_text += "\n\n### Response:\n"

                response_text = f"{out}{eos_token}"

            # 2. Conversational format (messages)
            elif "messages" in rec and isinstance(rec["messages"], list):
                msgs = rec["messages"]
                if hasattr(tokenizer, "apply_chat_template") and tokenizer.chat_template:
                    try:
                        all_text = tokenizer.apply_chat_template(msgs, tokenize=False)
                        non_last_msgs = msgs[:-1]
                        prompt_text = tokenizer.apply_chat_template(non_last_msgs, tokenize=False, add_generation_prompt=True)
                        response_text = msgs[-1].get("content", "") + eos_token
                    except Exception:
                        prompt_text = "\n".join([f"{m.get('role', 'user')}: {m.get('content', '')}" for m in msgs[:-1]]) + "\nassistant: "
                        response_text = msgs[-1].get("content", "") + eos_token
                else:
                    prompt_text = "\n".join([f"{m.get('role', 'user')}: {m.get('content', '')}" for m in msgs[:-1]]) + "\nassistant: "
                    response_text = msgs[-1].get("content", "") + eos_token

            # 3. Alpaca format
            elif "instruction" in rec or "input" in rec:
                instruction = str(rec.get("instruction", "")).strip()
                inp = str(rec.get("input", "")).strip()
                out = str(rec.get("output", "")).strip()
                if inp:
                    prompt_text = f"### Instruction:\n{instruction}\n\n### Input:\n{inp}\n\n### Response:\n"
                else:
                    prompt_text = f"### Instruction:\n{instruction}\n\n### Response:\n"
                response_text = f"{out}{eos_token}"

            # 4. Standard Prompt/Completion
            elif "prompt" in rec and "completion" in rec:
                prompt_text = str(rec.get("prompt", ""))
                response_text = str(rec.get("completion", "")) + eos_token

            # 5. General tabular fallback (for arbitrary CSV / TSV columns)
            else:
                cols = [k for k, v in rec.items() if k and v is not None and str(v).strip()]
                if len(cols) >= 2:
                    target_candidates = ["output", "response", "answer", "completion", "result", "feedback", "summary", "target", "label", "whatsapp", "email"]
                    out_key = None
                    for tc in target_candidates:
                        for c in cols:
                            if tc in c.lower():
                                out_key = c
                                break
                        if out_key:
                            break

                    if not out_key:
                        out_key = cols[-1]

                    in_keys = [c for c in cols if c != out_key]
                    prompt_parts = [f"{k}: {str(rec[k]).strip()}" for k in in_keys]
                    prompt_text = "### Instruction:\n" + "\n".join(prompt_parts) + "\n\n### Response:\n"
                    response_text = f"{str(rec[out_key]).strip()}{eos_token}"
                else:
                    continue

            if not prompt_text.strip() or not response_text.strip():
                continue

            # Tokenize prompt and full text
            full_text = prompt_text + response_text
            encoded_full = tokenizer(
                full_text,
                truncation=True,
                max_length=max_seq_length,
                return_tensors="pt"
            )
            encoded_prompt = tokenizer(
                prompt_text,
                truncation=True,
                max_length=max_seq_length,
                return_tensors="pt"
            )

            input_ids = encoded_full["input_ids"][0]
            attention_mask = encoded_full["attention_mask"][0]
            labels = input_ids.clone()

            # Mask out the prompt tokens with -100 so loss is computed solely on the response
            prompt_len = min(len(encoded_prompt["input_ids"][0]), len(labels))
            labels[:prompt_len] = -100

            self.examples.append({
                "input_ids": input_ids,
                "attention_mask": attention_mask,
                "labels": labels
            })

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, idx):
        return self.examples[idx]

def collate_fn(batch, pad_token_id=0):
    max_len = max(len(item["input_ids"]) for item in batch)
    input_ids = []
    attention_mask = []
    labels = []

    for item in batch:
        pad_len = max_len - len(item["input_ids"])
        input_ids.append(torch.cat([item["input_ids"], torch.full((pad_len,), pad_token_id, dtype=torch.long)]))
        attention_mask.append(torch.cat([item["attention_mask"], torch.zeros(pad_len, dtype=torch.long)]))
        labels.append(torch.cat([item["labels"], torch.full((pad_len,), -100, dtype=torch.long)]))

    return {
        "input_ids": torch.stack(input_ids),
        "attention_mask": torch.stack(attention_mask),
        "labels": torch.stack(labels),
    }

def main():
    parser = argparse.ArgumentParser(description="Zaylo Forge LoRA Fine-Tuner")
    parser.add_argument("--config", type=str, required=True, help="Path to JSON configuration file")
    parser.add_argument("--resume-checkpoint", type=str, default="", help="Path to checkpoint directory to resume from")
    args = parser.parse_args()

    with open(args.config, "r", encoding="utf-8") as f:
        cfg = json.load(f)

    checkpoint_path = cfg["checkpointPath"]
    dataset_path = cfg["datasetPath"]
    output_dir = cfg["outputDir"]
    objective = cfg.get("objective", "instruction")
    resume_checkpoint = args.resume_checkpoint or cfg.get("resumeCheckpointPath", "")

    lora_rank = int(cfg.get("loraRank", 8))
    lora_alpha = int(cfg.get("loraAlpha", 16))
    lora_dropout = float(cfg.get("loraDropout", 0.05))
    target_modules = cfg.get("targetModules", ["q_proj", "v_proj"])
    batch_size = max(1, int(cfg.get("batchSize", 1)))
    grad_accum = max(1, int(cfg.get("gradientAccumulationSteps", 4)))
    max_seq_len = int(cfg.get("maxSeqLength", 512))
    lr = float(cfg.get("learningRate", 2e-4))
    epochs = max(1, int(cfg.get("epochs", 3)))
    save_steps = int(cfg.get("saveSteps", 20))
    train_val_split = float(cfg.get("trainValSplit", 0.1))
    weight_decay = float(cfg.get("weightDecay", 0.01))
    warmup_ratio = float(cfg.get("warmupRatio", 0.05))
    precision_str = cfg.get("precision", "float32")

    os.makedirs(output_dir, exist_ok=True)
    checkpoints_dir = os.path.join(output_dir, "checkpoints")
    os.makedirs(checkpoints_dir, exist_ok=True)

    print(json.dumps({"type": "log", "level": "INFO", "message": f"Starting Forge LoRA training for {os.path.basename(checkpoint_path)}"}), flush=True)
    print(json.dumps({"type": "log", "level": "INFO", "message": f"Output directory: {output_dir}"}), flush=True)

    # 1. Device selection
    if torch.backends.mps.is_available() and precision_str != "float32":
        # Note: on macOS x86_64, MPS may have fallback limitations; test MPS availability
        device = torch.device("cpu")
        print(json.dumps({"type": "log", "level": "INFO", "message": "Using CPU backend for optimal numerical stability."}), flush=True)
    elif torch.cuda.is_available():
        device = torch.device("cuda")
        print(json.dumps({"type": "log", "level": "INFO", "message": f"Using CUDA backend: {torch.cuda.get_device_name(0)}"}), flush=True)
    else:
        device = torch.device("cpu")
        print(json.dumps({"type": "log", "level": "INFO", "message": "Using CPU device backend for training."}), flush=True)

    # Precision
    if precision_str == "float16" and device.type == "cuda":
        torch_dtype = torch.float16
    elif precision_str == "bfloat16" and (device.type == "cuda" or (device.type == "cpu" and torch.cuda.is_bf16_supported())):
        torch_dtype = torch.bfloat16
    else:
        torch_dtype = torch.float32

    # 2. Load Tokenizer & Model
    print(json.dumps({"type": "log", "level": "INFO", "message": f"Loading base tokenizer from {checkpoint_path}..."}), flush=True)
    from transformers import AutoTokenizer, AutoModelForCausalLM
    tokenizer = AutoTokenizer.from_pretrained(checkpoint_path, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
        tokenizer.pad_token_id = tokenizer.eos_token_id

    print(json.dumps({"type": "log", "level": "INFO", "message": f"Loading base model weights (dtype: {torch_dtype})..."}), flush=True)
    model = AutoModelForCausalLM.from_pretrained(
        checkpoint_path,
        torch_dtype=torch_dtype,
        trust_remote_code=True
    )
    model.to(device)

    # 3. Apply LoRA Config or Resume Checkpoint
    from peft import LoraConfig, get_peft_model, TaskType, PeftModel
    if resume_checkpoint and os.path.exists(resume_checkpoint):
        print(json.dumps({"type": "log", "level": "INFO", "message": f"Resuming LoRA adapter weights from checkpoint: {resume_checkpoint}..."}), flush=True)
        model = PeftModel.from_pretrained(model, resume_checkpoint, is_trainable=True)
    else:
        print(json.dumps({"type": "log", "level": "INFO", "message": f"Applying LoRA adapter: rank={lora_rank}, alpha={lora_alpha}, target_modules={target_modules}..."}), flush=True)
        peft_config = LoraConfig(
            task_type=TaskType.CAUSAL_LM,
            r=lora_rank,
            lora_alpha=lora_alpha,
            lora_dropout=lora_dropout,
            target_modules=target_modules,
            bias="none",
        )
        model = get_peft_model(model, peft_config)

    trainable_params, all_params = model.get_nb_trainable_parameters()
    trainable_pct = 100 * trainable_params / all_params
    print(json.dumps({
        "type": "log",
        "level": "INFO",
        "message": f"Trainable params: {trainable_params:,} / {all_params:,} ({trainable_pct:.2f}%)"
    }), flush=True)

    # 4. Load Dataset
    print(json.dumps({"type": "log", "level": "INFO", "message": f"Reading dataset from {dataset_path}..."}), flush=True)
    records = []
    if dataset_path.endswith(".csv"):
        import csv
        with open(dataset_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                records.append(row)
    else:
        with open(dataset_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        records.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass

    if not records:
        print(json.dumps({"type": "error", "message": "Dataset contains 0 valid parseable records."}), flush=True)
        sys.exit(1)

    print(json.dumps({"type": "log", "level": "INFO", "message": f"Parsed {len(records)} records. Tokenizing..."}), flush=True)

    column_mapping = cfg.get("columnMapping") or cfg.get("column_mapping") or {}
    dataset = InstructionDataset(records, tokenizer, max_seq_length=max_seq_len, objective=objective, column_mapping=column_mapping)
    if len(dataset) == 0:
        print(json.dumps({"type": "error", "message": "No valid formatted instruction pairs found in dataset."}), flush=True)
        sys.exit(1)

    val_size = int(len(dataset) * train_val_split)
    train_size = len(dataset) - val_size
    if val_size > 0:
        train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])
    else:
        train_dataset = dataset
        val_dataset = None

    pad_id = tokenizer.pad_token_id if tokenizer.pad_token_id is not None else 0
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        collate_fn=lambda b: collate_fn(b, pad_token_id=pad_id)
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        collate_fn=lambda b: collate_fn(b, pad_token_id=pad_id)
    ) if val_dataset else None

    # Calculate steps
    steps_per_epoch = math.ceil(len(train_loader) / grad_accum)
    total_steps = steps_per_epoch * epochs

    print(json.dumps({
        "type": "log",
        "level": "INFO",
        "message": f"Training plan: {epochs} epochs, {len(train_loader)} batches/epoch, {grad_accum} grad accum, {total_steps} total optimizer steps."
    }), flush=True)

    # 5. Optimizer & LR Scheduler
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=weight_decay)
    warmup_steps = int(total_steps * warmup_ratio)

    def lr_lambda(current_step):
        if current_step < warmup_steps:
            return float(current_step) / float(max(1, warmup_steps))
        progress = float(current_step - warmup_steps) / float(max(1, total_steps - warmup_steps))
        return max(0.0, 0.5 * (1.0 + math.cos(math.pi * progress)))

    scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_lambda)

    # 6. Training Loop
    global_step = 0
    start_time = time.time()
    proc = psutil.Process() if HAS_PSUTIL else None
    model.train()

    saved_checkpoints = []

    print(json.dumps({"type": "log", "level": "INFO", "message": "Starting optimization loop..."}), flush=True)

    for epoch in range(1, epochs + 1):
        if interrupted:
            break

        running_loss = 0.0
        accum_steps = 0
        optimizer.zero_grad()

        for batch_idx, batch in enumerate(train_loader):
            if interrupted:
                break

            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["labels"].to(device)

            outputs = model(input_ids=input_ids, attention_mask=attention_mask, labels=labels)
            loss = outputs.loss / grad_accum
            loss.backward()

            running_loss += outputs.loss.item()
            accum_steps += 1

            if accum_steps == grad_accum or (batch_idx + 1) == len(train_loader):
                # Calculate real gradient norm before clipping
                total_norm = 0.0
                for p in model.parameters():
                    if p.grad is not None:
                        param_norm = p.grad.detach().data.norm(2)
                        total_norm += param_norm.item() ** 2
                grad_norm = total_norm ** 0.5

                # Calculate token prediction accuracy on non-masked response tokens
                with torch.no_grad():
                    preds = torch.argmax(outputs.logits, dim=-1)
                    mask = (labels != -100)
                    if mask.sum() > 0:
                        token_acc = (preds[mask] == labels[mask]).float().mean().item()
                    else:
                        token_acc = 0.0

                torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                optimizer.step()
                scheduler.step()
                optimizer.zero_grad()
                accum_steps = 0

                global_step += 1
                avg_loss = running_loss / grad_accum
                running_loss = 0.0

                elapsed = time.time() - start_time
                steps_remaining = total_steps - global_step
                secs_per_step = elapsed / max(1, global_step)
                est_remaining = steps_remaining * secs_per_step

                # Memory usage
                mem_bytes = 0
                cpu_pct = 0.0
                if proc:
                    try:
                        mem_bytes = proc.memory_info().rss
                        cpu_pct = proc.cpu_percent()
                    except Exception:
                        pass

                current_lr = scheduler.get_last_lr()[0]

                # Evaluate if needed
                eval_loss = None
                if val_loader and (global_step % max(1, save_steps) == 0 or global_step == total_steps):
                    model.eval()
                    val_running_loss = 0.0
                    val_batches = 0
                    with torch.no_grad():
                        for vbatch in val_loader:
                            v_input = vbatch["input_ids"].to(device)
                            v_mask = vbatch["attention_mask"].to(device)
                            v_labels = vbatch["labels"].to(device)
                            v_out = model(input_ids=v_input, attention_mask=v_mask, labels=v_labels)
                            val_running_loss += v_out.loss.item()
                            val_batches += 1
                    eval_loss = round(val_running_loss / max(1, val_batches), 4)
                    model.train()

                metric_payload = {
                    "type": "metric",
                    "step": global_step,
                    "totalSteps": total_steps,
                    "epoch": epoch,
                    "totalEpochs": epochs,
                    "loss": round(avg_loss, 4),
                    "evalLoss": eval_loss,
                    "learningRate": round(current_lr, 8),
                    "gradNorm": round(grad_norm, 4),
                    "tokenAccuracy": round(token_acc, 4),
                    "tokensPerSec": round((batch_size * max_seq_len) / max(0.01, secs_per_step), 1),
                    "elapsedSeconds": round(elapsed, 1),
                    "estimatedRemainingSeconds": round(est_remaining, 1),
                    "cpuPercent": round(cpu_pct, 1),
                    "memoryBytes": mem_bytes
                }
                print(json.dumps(metric_payload), flush=True)

                # Checkpoint saving
                if global_step % save_steps == 0 or global_step == total_steps:
                    ckpt_name = f"checkpoint-{global_step}"
                    ckpt_path = os.path.join(checkpoints_dir, ckpt_name)
                    model.save_pretrained(ckpt_path)
                    tokenizer.save_pretrained(ckpt_path)

                    total_ckpt_size = 0
                    for dirpath, _, filenames in os.walk(ckpt_path):
                        for f in filenames:
                            total_ckpt_size += os.path.getsize(os.path.join(dirpath, f))

                    saved_checkpoints.append({
                        "step": global_step,
                        "path": ckpt_path,
                        "loss": avg_loss,
                        "sizeBytes": total_ckpt_size,
                        "recoverable": True,
                        "createdAt": int(time.time() * 1000)
                    })
                    print(json.dumps({
                        "type": "checkpoint",
                        "step": global_step,
                        "path": ckpt_path,
                        "loss": round(avg_loss, 4),
                        "sizeBytes": total_ckpt_size,
                        "recoverable": True
                    }), flush=True)

    # 7. Final Artifact
    final_adapter_dir = os.path.join(output_dir, "final_adapter")
    print(json.dumps({"type": "log", "level": "INFO", "message": f"Saving final LoRA adapter to {final_adapter_dir}..."}), flush=True)
    model.save_pretrained(final_adapter_dir)
    tokenizer.save_pretrained(final_adapter_dir)

    total_size = 0
    for dirpath, dirnames, filenames in os.walk(final_adapter_dir):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            total_size += os.path.getsize(fp)

    total_duration = time.time() - start_time
    status = "CANCELLED" if interrupted else "COMPLETED"

    print(json.dumps({
        "type": "completed",
        "status": status,
        "artifactPath": final_adapter_dir,
        "artifactSize": total_size,
        "finalStep": global_step,
        "totalSteps": total_steps,
        "durationSeconds": round(total_duration, 1),
        "checkpoints": saved_checkpoints
    }), flush=True)

if __name__ == "__main__":
    main()
