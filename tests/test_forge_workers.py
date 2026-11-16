"""Lightweight worker boundary regressions. Does not load models or train."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
FORGE = ROOT / 'apps/desktop/electron/forge/scripts'


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, FORGE / f'{name}.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class TextTensor:
    """Only the token/mask operations used while constructing dataset examples."""
    def __init__(self, values):
        self.values = list(values)

    def __len__(self):
        return len(self.values)

    def __getitem__(self, index):
        value = self.values[index]
        return TextTensor(value) if isinstance(index, slice) else value

    def __setitem__(self, index, value):
        if isinstance(index, slice):
            self.values[index] = [value] * len(range(*index.indices(len(self.values))))
        else:
            self.values[index] = value

    def clone(self):
        return TextTensor(self.values)

    def __ne__(self, other):
        return types.SimpleNamespace(any=lambda: any(value != other for value in self.values))


class RecordingTokenizer:
    eos_token = '<eos>'
    eos_token_id = 1
    pad_token_id = 0
    chat_template = '<native>'

    def __init__(self):
        self.texts = []
        self.chat_calls = 0

    def __call__(self, text, **kwargs):
        self.texts.append(text)
        size = min(len(text), kwargs.get('max_length', len(text)))
        return {'input_ids': [TextTensor(range(size))], 'attention_mask': [TextTensor([1] * size)]}

    def apply_chat_template(self, messages, tokenize=False, add_generation_prompt=False):
        self.chat_calls += 1
        text = '<native>' + ''.join(f"<{message['role']}>{message['content']}</{message['role']}>" for message in messages)
        return text + ('<assistant>' if add_generation_prompt else '')


def load_dataset_constructor():
    torch = types.ModuleType('torch')
    utils = types.ModuleType('torch.utils')
    data = types.ModuleType('torch.utils.data')
    data.Dataset = object
    data.DataLoader = object
    utils.data = data
    torch.utils = utils
    with patch.dict(sys.modules, {'torch': torch, 'torch.utils': utils, 'torch.utils.data': data, 'dataset_io': load_script('dataset_io')}), patch('signal.signal'):
        return load_script('train_lora').InstructionDataset


class WorkerDeliveryTests(unittest.TestCase):
    def test_alpaca_input_section_is_identical_for_training_and_evaluation(self):
        constructor = load_dataset_constructor()
        comparator = load_script('evaluate_compare')
        tokenizer = RecordingTokenizer()
        dataset = constructor([{'instruction': 'Translate to French', 'input': 'Good morning', 'output': 'Bonjour'}], tokenizer, max_seq_length=2048)
        saved = json.loads(json.dumps(dataset.records[0]))
        expected_prompt = '### Instruction:\nTranslate to French\n\n### Input:\nGood morning\n\n### Response:\n'
        self.assertEqual(saved['expectedResponse'], 'Bonjour')
        self.assertEqual(tokenizer.texts[-1], expected_prompt)
        comparator.encode_prompt(tokenizer, saved['formattedPrompt'], already_formatted=True)
        self.assertEqual(tokenizer.texts[-1], expected_prompt)
        self.assertEqual(tokenizer.chat_calls, 0)

    def test_instruction_input_and_column_mapping_survive_training_to_evaluation(self):
        constructor = load_dataset_constructor()
        comparator = load_script('evaluate_compare')
        record = {'ask': 'Translate to French', 'context': 'Good morning', 'answer': 'Bonjour', 'rules': 'Return the translation only.'}
        mapping = {'instructionColumn': 'ask', 'inputColumn': 'context', 'outputColumn': 'answer', 'systemColumn': 'rules'}
        tokenizer = RecordingTokenizer()
        dataset = constructor([record], tokenizer, max_seq_length=2048, column_mapping=mapping)
        expected_prompt = '### System:\nReturn the translation only.\n\n### Instruction:\nTranslate to French\n\n### Input:\nGood morning\n\n### Response:\n'
        saved = json.loads(json.dumps(dataset.records[0]))
        self.assertEqual(saved, {'formattedPrompt': expected_prompt, 'expectedResponse': 'Bonjour'})
        training_prompt = tokenizer.texts[-1]
        comparator.encode_prompt(tokenizer, saved['formattedPrompt'], already_formatted=True)
        self.assertEqual(tokenizer.texts[-1], expected_prompt)
        self.assertEqual(tokenizer.texts[-1], training_prompt)
        self.assertEqual(tokenizer.chat_calls, 0)

    def test_native_multi_turn_chat_is_not_wrapped_as_another_user_message(self):
        constructor = load_dataset_constructor()
        comparator = load_script('evaluate_compare')
        tokenizer = RecordingTokenizer()
        record = {'messages': [
            {'role': 'system', 'content': 'Be concise.'},
            {'role': 'user', 'content': 'My name is Ada.'},
            {'role': 'assistant', 'content': 'Hello Ada.'},
            {'role': 'user', 'content': 'What is my name?'},
            {'role': 'assistant', 'content': 'Ada.'},
        ]}
        dataset = constructor([record], tokenizer, max_seq_length=2048)
        saved = json.loads(json.dumps(dataset.records[0]))
        expected_prompt = '<native><system>Be concise.</system><user>My name is Ada.</user><assistant>Hello Ada.</assistant><user>What is my name?</user><assistant>'
        self.assertEqual(saved, {'formattedPrompt': expected_prompt, 'expectedResponse': 'Ada.'})
        training_prompt = tokenizer.texts[-1]
        chat_calls = tokenizer.chat_calls
        comparator.encode_prompt(tokenizer, saved['formattedPrompt'], already_formatted=True)
        self.assertEqual(tokenizer.texts[-1], expected_prompt)
        self.assertEqual(tokenizer.texts[-1], training_prompt)
        self.assertEqual(tokenizer.chat_calls, chat_calls)

    def test_json_arrays_and_jsonl_use_the_same_record_shape(self):
        reader = load_script('dataset_io')
        expected = [{'instruction': 'Hello', 'output': 'Hi'}, {'instruction': 'Bye', 'output': 'Goodbye'}]
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for name, text in [('records.json', json.dumps(expected)), ('records.jsonl', '\n'.join(json.dumps(row) for row in expected))]:
                path = root / name
                path.write_text(text)
                self.assertEqual(reader.read_records(path), expected)

    def test_parquet_records_are_read_by_shared_dataset_reader(self):
        reader = load_script('dataset_io')
        parquet = types.ModuleType('pyarrow.parquet')
        parquet.read_table = lambda filename: types.SimpleNamespace(to_pylist=lambda: [{'instruction': 'Hello', 'output': 'Hi'}])
        arrow = types.ModuleType('pyarrow')
        arrow.parquet = parquet
        with patch.dict(sys.modules, {'pyarrow': arrow, 'pyarrow.parquet': parquet}):
            self.assertEqual(reader.read_records('example.parquet'), [{'instruction': 'Hello', 'output': 'Hi'}])
        with patch.dict(sys.modules, {'pyarrow': None, 'pyarrow.parquet': None}):
            with self.assertRaisesRegex(RuntimeError, 'require pyarrow'):
                reader.read_records('example.parquet')

    def test_gguf_export_calls_installed_converter_and_never_overwrites(self):
        exporter = load_script('export_gguf')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            converter = root / 'converter.py'
            converter.write_text("import sys\nfrom pathlib import Path\nPath(sys.argv[sys.argv.index('--outfile')+1]).write_bytes(b'GGUFtest')\n")
            target = root / 'model.gguf'
            with patch.dict(os.environ, {'ZAYLO_GGUF_CONVERTER': str(converter)}):
                exporter.export_gguf(str(root / 'base'), str(target))
                self.assertEqual(target.read_bytes(), b'GGUFtest')
                with self.assertRaises(FileExistsError):
                    exporter.export_gguf(str(root / 'base'), str(target))
                self.assertEqual(target.read_bytes(), b'GGUFtest')

    def test_comparator_rejects_a_requested_missing_adapter(self):
        with tempfile.TemporaryDirectory() as directory:
            result = subprocess.run([
                sys.executable, str(FORGE / 'evaluate_compare.py'),
                '--base-model', directory, '--adapter', str(Path(directory) / 'missing'),
                '--prompt', 'Hello',
            ], capture_output=True, text=True, timeout=10)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('Adapter path not found', result.stderr)
            self.assertNotIn('fineTunedResponse', result.stdout)

    def test_unavailable_diffusion_model_reports_error_without_fake_image(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            # Stub only optional runtime dependencies; execute the real worker/error path.
            (root / 'torch.py').write_text("""
from types import SimpleNamespace
cuda = SimpleNamespace(is_available=lambda: False)
backends = SimpleNamespace(mps=SimpleNamespace(is_available=lambda: False))
float32 = 'float32'
float16 = 'float16'
class device:
    def __init__(self, kind): self.type = kind
class Generator:
    def __init__(self, *args, **kwargs): pass
    def manual_seed(self, seed): return self
""")
            (root / 'PIL.py').write_text('Image = object()\n')
            (root / 'diffusers.py').write_text("""
class Pipeline:
    @classmethod
    def from_pretrained(cls, *args, **kwargs):
        raise RuntimeError('Missing local test weights')
AutoPipelineForText2Image = StableDiffusionPipeline = StableDiffusionXLPipeline = Pipeline
""")
            config = root / 'config.json'
            config.write_text(json.dumps({'modelId': 'test/missing', 'prompt': 'A red apple', 'steps': 1, 'width': 64, 'height': 64, 'outputDir': str(root / 'output')}))
            result = subprocess.run([sys.executable, str(ROOT / 'packages/inference/src/image/scripts/generate_image.py'), '--config', str(config)], capture_output=True, text=True, env={**os.environ, 'PYTHONPATH': directory}, timeout=10)
            events = [json.loads(line) for line in result.stdout.splitlines() if line.strip()]
            self.assertEqual(result.returncode, 1)
            self.assertEqual(events[-1]['type'], 'error')
            self.assertIn('No diffusion pipeline could be loaded', events[-1]['message'])
            self.assertFalse(any(event['type'] == 'completed' for event in events))
            self.assertEqual(list(root.rglob('*.png')), [])


if __name__ == '__main__':
    unittest.main()
