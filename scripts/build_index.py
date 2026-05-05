from __future__ import annotations

import os
import sys

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.config import load_config
from backend.rag import build_index


def main() -> int:
    config = load_config()
    data_dir = os.path.join(project_root, "data")
    count = build_index(config, data_dir)
    print(f"Indexed {count} records from {data_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
