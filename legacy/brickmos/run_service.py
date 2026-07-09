#!/usr/bin/env python3
"""Runs the brickmos HTTP upload service (FastAPI + uvicorn).

Usage:
    python run_service.py [--port 8001] [--host 0.0.0.0]

Requires the "service" extra: pip install -e ".[service]"
"""

import argparse

import uvicorn


def main():
    parser = argparse.ArgumentParser(description="Run the brickmos upload service")
    parser.add_argument("--host", type=str, default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8001)
    parser.add_argument("--reload", action="store_true", default=False)
    args = parser.parse_args()

    uvicorn.run("brickmos.service:app", host=args.host, port=args.port, reload=args.reload)


if __name__ == "__main__":
    main()
