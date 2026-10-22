import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  DatasetAnalysis,
  DatasetColumnMapping,
  DatasetFormat,
} from '@local-ai/shared';
import { getDefaultForgeDir } from '@local-ai/shared';

export class DatasetParser {
  public static parseFile(
    filePath: string,
    columnMapping?: DatasetColumnMapping,
    maxPreview = 10
  ): DatasetAnalysis {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Dataset file not found: ${filePath}`);
    }

    const stats = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    let rawRecords: any[] = [];
    const invalidSampleErrors: string[] = [];

    if (ext === '.csv') {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
      if (lines.length < 2) {
        throw new Error('CSV file must contain a header row and at least one data row.');
      }

      // Simple CSV line parser
      const parseCsvLine = (line: string): string[] => {
        const result: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
              cur += '"';
              i++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            result.push(cur.trim());
            cur = '';
          } else {
            cur += char;
          }
        }
        result.push(cur.trim());
        return result;
      };

      const headers = parseCsvLine(lines[0]);
      for (let i = 1; i < lines.length; i++) {
        try {
          const values = parseCsvLine(lines[i]);
          const row: Record<string, string> = {};
          headers.forEach((h, idx) => {
            row[h] = values[idx] || '';
          });
          rawRecords.push(row);
        } catch (err: any) {
          if (invalidSampleErrors.length < 5) {
            invalidSampleErrors.push(`Row ${i + 1}: Malformed CSV row (${err.message})`);
          }
        }
      }
    } else {
      // JSONL or JSON
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        try {
          const parsed = JSON.parse(line);
          rawRecords.push(parsed);
        } catch (err: any) {
          if (invalidSampleErrors.length < 5) {
            invalidSampleErrors.push(`Line ${i + 1}: Malformed JSON (${err.message})`);
          }
        }
      }
    }

    const totalRecords = rawRecords.length + invalidSampleErrors.length;
    let detectedFormat: DatasetFormat = 'unknown';

    // Format detection
    if (rawRecords.length > 0) {
      const sample = rawRecords[0];
      if (sample.messages && Array.isArray(sample.messages)) {
        detectedFormat = 'conversational';
      } else if (sample.instruction !== undefined || sample.input !== undefined) {
        detectedFormat = 'instruction';
      } else if (sample.prompt !== undefined && sample.completion !== undefined) {
        detectedFormat = 'prompt_completion';
      } else if (ext === '.csv') {
        detectedFormat = 'csv';
      }
    }

    const validExamples: any[] = [];
    const seenHashes = new Set<string>();
    let duplicateCount = 0;
    let validCount = 0;
    const tokenLengths: number[] = [];

    for (let idx = 0; idx < rawRecords.length; idx++) {
      const rec = rawRecords[idx];
      let promptText = '';
      let responseText = '';

      // Apply mapping if provided
      if (columnMapping) {
        const instCol =
          columnMapping.instructionColumn || columnMapping.promptColumn;
        const outCol =
          columnMapping.outputColumn ||
          columnMapping.completionColumn ||
          columnMapping.responseColumn;
        const inpCol = columnMapping.inputColumn;

        if (instCol && rec[instCol] !== undefined) {
          const inp = inpCol && rec[inpCol] ? String(rec[inpCol]).trim() : '';
          const inst = String(rec[instCol] || '').trim();
          promptText = inp ? `${inst}\n${inp}` : inst;
          responseText = outCol && rec[outCol] !== undefined ? String(rec[outCol] || '').trim() : '';
        }
      }

      // Default fallback if no mapping or mapping didn't yield text
      if (!promptText && !responseText) {
        if (rec.messages && Array.isArray(rec.messages)) {
          promptText = rec.messages
            .slice(0, -1)
            .map((m: any) => `${m.role || 'user'}: ${m.content || ''}`)
            .join('\n');
          responseText = rec.messages[rec.messages.length - 1]?.content || '';
        } else if (rec.instruction || rec.input) {
          promptText = rec.input ? `${rec.instruction}\n${rec.input}` : rec.instruction || '';
          responseText = rec.output || '';
        } else if (rec.prompt || rec.completion) {
          promptText = rec.prompt || '';
          responseText = rec.completion || '';
        } else if (typeof rec === 'object' && rec !== null) {
          // Tabular / CSV heuristic fallback for arbitrary header names
          const keys = Object.keys(rec).filter(
            (k) => k && rec[k] !== undefined && String(rec[k]).trim().length > 0
          );
          if (keys.length >= 2) {
            const targetCandidates = [
              'output',
              'response',
              'answer',
              'completion',
              'result',
              'feedback',
              'summary',
              'target',
              'label',
            ];
            let targetKey = keys.find((k) =>
              targetCandidates.some((tc) => k.toLowerCase().includes(tc))
            );
            if (!targetKey) {
              targetKey = keys[keys.length - 1]; // fallback to last column
            }
            const promptKeys = keys.filter((k) => k !== targetKey);
            promptText = promptKeys.map((k) => `${k}: ${rec[k]}`).join('\n');
            responseText = String(rec[targetKey] || '').trim();
          }
        }
      }

      if (!promptText.trim() || !responseText.trim()) {
        if (invalidSampleErrors.length < 5) {
          invalidSampleErrors.push(
            `Record ${idx + 1}: Missing prompt/instruction or response/completion text.`
          );
        }
        continue;
      }

      // Check duplicates
      const hash = crypto
        .createHash('md5')
        .update(promptText.trim() + '|||' + responseText.trim())
        .digest('hex');

      if (seenHashes.has(hash)) {
        duplicateCount++;
      } else {
        seenHashes.add(hash);
      }

      // Estimate tokens (~3.8 chars per token)
      const approxTokens = Math.max(1, Math.round((promptText.length + responseText.length) / 3.8));
      tokenLengths.push(approxTokens);

      validCount++;
      if (validExamples.length < maxPreview) {
        validExamples.push({
          index: idx + 1,
          prompt: promptText.trim(),
          response: responseText.trim(),
          estimatedTokens: approxTokens,
        });
      }
    }

    // Token length statistics
    tokenLengths.sort((a, b) => a - b);
    const minTok = tokenLengths.length > 0 ? tokenLengths[0] : 0;
    const maxTok = tokenLengths.length > 0 ? tokenLengths[tokenLengths.length - 1] : 0;
    const meanTok =
      tokenLengths.length > 0
        ? Math.round(tokenLengths.reduce((a, b) => a + b, 0) / tokenLengths.length)
        : 0;
    const p50 =
      tokenLengths.length > 0 ? tokenLengths[Math.floor(tokenLengths.length * 0.5)] : 0;
    const p95 =
      tokenLengths.length > 0 ? tokenLengths[Math.floor(tokenLengths.length * 0.95)] : 0;

    return {
      filePath,
      fileName,
      fileSizeBytes: stats.size,
      totalRecords,
      validRecords: validCount,
      invalidRecords: totalRecords - validCount,
      duplicateRecords: duplicateCount,
      detectedFormat,
      columns: rawRecords.length > 0 ? Object.keys(rawRecords[0]) : undefined,
      columnMapping,
      exampleRecords: validExamples,
      invalidSampleErrors,
      tokenLengthDistribution: {
        min: minTok,
        max: maxTok,
        mean: meanTok,
        p50,
        p95,
      },
    };
  }

  public static createSampleDataset(type: 'instruction' | 'conversational'): {
    filePath: string;
    analysis: DatasetAnalysis;
  } {
    const samplesDir = path.join(getDefaultForgeDir(), 'samples');
    if (!fs.existsSync(samplesDir)) {
      fs.mkdirSync(samplesDir, { recursive: true });
    }

    if (type === 'conversational') {
      const filePath = path.join(samplesDir, 'customer_support_conversations.jsonl');
      const lines = [
        {
          messages: [
            { role: 'system', content: 'You are a helpful, professional technical support assistant for Zaylo AI.' },
            { role: 'user', content: 'How do I run a model completely offline in Zaylo?' },
            { role: 'assistant', content: 'To run a model offline, ensure it is downloaded in the Models tab. Once downloaded, start the server. Zaylo loads and executes all inference locally without communicating with external cloud APIs.' }
          ]
        },
        {
          messages: [
            { role: 'system', content: 'You are a helpful, professional technical support assistant for Zaylo AI.' },
            { role: 'user', content: 'Can I connect my mobile phone to my desktop Zaylo server?' },
            { role: 'assistant', content: 'Yes! Enable LAN access in the Server & API tab, generate a secure pairing QR code in the Devices tab, and scan it using the Zaylo companion mobile app on the same local Wi-Fi network.' }
          ]
        },
        {
          messages: [
            { role: 'system', content: 'You are a helpful, professional technical support assistant for Zaylo AI.' },
            { role: 'user', content: 'What format do models need to be in for fine-tuning in Forge?' },
            { role: 'assistant', content: 'Forge uses parameter-efficient fine-tuning (LoRA). Training requires unquantized base Safetensors weights so backpropagation gradients can be computed accurately.' }
          ]
        },
        {
          messages: [
            { role: 'system', content: 'You are a helpful, professional technical support assistant for Zaylo AI.' },
            { role: 'user', content: 'What is a LoRA adapter?' },
            { role: 'assistant', content: 'A LoRA (Low-Rank Adaptation) adapter trains small rank-decomposition matrices attached to model attention layers rather than retraining all weights. This reduces training memory and disk requirements by over 95% while achieving comparable quality.' }
          ]
        },
        {
          messages: [
            { role: 'system', content: 'You are a helpful, professional technical support assistant for Zaylo AI.' },
            { role: 'user', content: 'Where are my fine-tuned adapters stored?' },
            { role: 'assistant', content: 'Your trained adapters are securely stored in your local application directory under the Forge folder. You can review them anytime in the Fine-Tuned Models section of Forge.' }
          ]
        }
      ];

      fs.writeFileSync(filePath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
      return { filePath, analysis: this.parseFile(filePath) };
    } else {
      const filePath = path.join(samplesDir, 'system_instruction_tuning.jsonl');
      const lines = [
        {
          instruction: 'Explain the function of temperature in language model sampling.',
          input: '',
          output: 'Temperature controls the randomness of token selection during text generation. A temperature closer to 0 makes generation deterministic, selecting the highest-probability tokens. Higher values (e.g. 0.7 to 1.0) flatten the probability distribution, encouraging more creative and diverse responses.'
        },
        {
          instruction: 'Convert the following timestamp into a human-readable date format.',
          input: '1729500000',
          output: 'The timestamp 1729500000 corresponds to Monday, October 21, 2024 at 08:40:00 UTC.'
        },
        {
          instruction: 'Summarize the primary benefits of Low-Rank Adaptation (LoRA) for LLM fine-tuning.',
          input: '',
          output: '1. Memory Efficiency: Only trains low-rank decomposition matrices, saving massive amounts of GPU/CPU VRAM.\n2. Modular Deployment: Multiple adapters can be swapped or combined on a single shared base model.\n3. Fast Checkpointing: Adapters are typically tens of megabytes rather than dozens of gigabytes.'
        },
        {
          instruction: 'Write a concise error message for a missing configuration file.',
          input: 'File: /etc/zaylo/config.json',
          output: 'Error: Configuration file not found at /etc/zaylo/config.json. Please ensure the file exists and has read permissions.'
        },
        {
          instruction: 'Explain the difference between GGUF and Safetensors formats.',
          input: '',
          output: 'Safetensors is a format designed for storing tensors and unquantized model checkpoints safely and fast for PyTorch/HuggingFace workflows. GGUF is a binary file format optimized for fast quantized local CPU/GPU inference with llama.cpp.'
        }
      ];

      fs.writeFileSync(filePath, lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
      return { filePath, analysis: this.parseFile(filePath) };
    }
  }
}
