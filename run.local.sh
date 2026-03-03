#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [[ ! -f "env.sh" ]]; then
  echo "Missing env.sh. Copy env.example to env.sh and fill values."
  exit 1
fi

source "./env.sh"

if [[ ! -d "venv" ]]; then
  python3 -m venv venv
fi

source "venv/bin/activate"
pip install -q --disable-pip-version-check requests legendary-gl

mkdir -p "${OUTPUT_DIR:-data}"
python sync_games.py
