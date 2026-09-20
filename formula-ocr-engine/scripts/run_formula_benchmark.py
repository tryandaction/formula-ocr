from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path

from formula_ocr_engine.benchmark import PaddleCropClient, run_benchmark
from formula_ocr_engine.engines.paddle_formula import create_paddle_formula_engine


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--crop-root", type=Path, required=True)
    parser.add_argument("--variants", default="original")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not os.environ.get("RUN_MODEL_TESTS"):
        raise SystemExit("set RUN_MODEL_TESTS=1 to run model-backed benchmark")
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    report = run_benchmark(
        manifest,
        PaddleCropClient(args.crop_root, create_paddle_formula_engine()),
        [value for value in args.variants.split(",") if value],
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=args.output.parent,
        prefix=f".{args.output.name}.",
        delete=False,
    ) as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)
        temporary = Path(handle.name)
    temporary.replace(args.output)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
