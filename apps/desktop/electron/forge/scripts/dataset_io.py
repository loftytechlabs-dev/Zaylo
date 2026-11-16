"""Shared dataset reader for previews and training. Parquet requires pyarrow."""
import argparse
import csv
import json
from pathlib import Path


def read_records(filename):
    path = Path(filename)
    if path.suffix.lower() in (".parquet", ".parq"):
        try:
            import pyarrow.parquet as parquet
        except ImportError as error:
            raise RuntimeError("Parquet datasets require pyarrow in the selected Python environment. Install pyarrow and retry.") from error
        records = parquet.read_table(path).to_pylist()
    elif path.suffix.lower() == ".csv":
        with path.open(encoding="utf-8", newline="") as source:
            records = list(csv.DictReader(source))
    else:
        content = path.read_text(encoding="utf-8")
        if path.suffix.lower() == ".json":
            try:
                parsed = json.loads(content)
                records = parsed if isinstance(parsed, list) else [parsed]
            except json.JSONDecodeError:
                records = [json.loads(line) for line in content.splitlines() if line.strip()]
        else:
            records = [json.loads(line) for line in content.splitlines() if line.strip()]
    if not all(isinstance(record, dict) for record in records):
        raise ValueError("Every dataset record must be an object with named fields.")
    return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    args = parser.parse_args()
    print(json.dumps(read_records(args.input), default=str))
