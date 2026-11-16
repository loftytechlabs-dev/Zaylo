"""Export merged Hugging Face weights with an installed llama.cpp converter."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile


def export_gguf(model, output):
    converter = os.environ.get("ZAYLO_GGUF_CONVERTER")
    if not converter and os.environ.get("LLAMA_CPP_DIR"):
        converter = str(Path(os.environ["LLAMA_CPP_DIR"]) / "convert_hf_to_gguf.py")
    converter = converter or shutil.which("convert_hf_to_gguf.py")
    if not converter or not Path(converter).is_file():
        raise RuntimeError("GGUF export requires llama.cpp's convert_hf_to_gguf.py and its Python requirements. Set ZAYLO_GGUF_CONVERTER to that installed file, or LLAMA_CPP_DIR to your llama.cpp checkout. Nothing is installed automatically.")
    target = Path(output)
    if target.exists():
        raise FileExistsError(f"Export already exists: {target}. Choose another directory.")
    target.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(suffix=".gguf", dir=target.parent)
    os.close(handle)
    try:
        result = subprocess.run([sys.executable, converter, model, "--outfile", temporary, "--outtype", "f16"], capture_output=True, text=True,
                                env={**os.environ, "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1"})
        if result.returncode:
            raise RuntimeError(f"llama.cpp conversion failed. Check converter requirements and model support: {result.stderr[-4000:]}")
        with open(temporary, "rb") as artifact:
            if artifact.read(4) != b"GGUF":
                raise RuntimeError("Converter did not produce a valid GGUF file.")
        os.link(temporary, target)
    finally:
        Path(temporary).unlink(missing_ok=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    export_gguf(args.model, args.output)
