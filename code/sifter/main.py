"""CLI entrypoint. The FastAPI app lives in sifter.server."""
from .server import app, run  # noqa: F401

if __name__ == "__main__":
    run()
