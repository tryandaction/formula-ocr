from __future__ import annotations

import argparse
import json
import os
import tempfile
from pathlib import Path

from formula_ocr_engine.detection_benchmark import run_detection_benchmark
from formula_ocr_engine.engines.pix2text_detection import create_pix2text_detection_engine


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--repository-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not os.environ.get("RUN_MODEL_TESTS"):
        raise SystemExit("set RUN_MODEL_TESTS=1 to run model-backed benchmark")
    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    predictions = run_detection_benchmark(
        manifest,
        args.repository_root,
        create_pix2text_detection_engine(),
    )
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        dir=args.output.parent,
        prefix=f".{args.output.name}.",
        delete=False,
    ) as handle:
        json.dump(predictions, handle, ensure_ascii=False, indent=2)
        temporary = Path(handle.name)
    temporary.replace(args.output)
    print(json.dumps({"pages": len(manifest["evaluatedPages"]), "predictions": len(predictions)}))


if __name__ == "__main__":
    main()
