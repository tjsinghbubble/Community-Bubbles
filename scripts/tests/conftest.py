"""Pytest fixtures for the manage_devices suite.

The script is loaded per-test via SourceFileLoader (it works whether the file
is `manage_devices` or `manage_devices.py`) with MANAGE_DEVICES_DB pointed at
a per-test temp SQLite DB, so every test gets a fresh module + fresh DB and
never touches the developer's .device-manager database or the real toolchain.

Run: <venv>/bin/pytest scripts/tests  (pytest is the only non-stdlib dep).
"""
import importlib.machinery
import importlib.util
import os
import sys
from pathlib import Path

import pytest

SCRIPTS = Path(__file__).resolve().parent.parent


def load_manage_devices(db_path):
    """Load the manage_devices script as a throwaway module bound to db_path."""
    os.environ["MANAGE_DEVICES_DB"] = str(db_path)
    for cand in (SCRIPTS / "manage_devices", SCRIPTS / "manage_devices.py"):
        if cand.exists():
            loader = importlib.machinery.SourceFileLoader(
                "manage_devices_under_test", str(cand))
            spec = importlib.util.spec_from_loader(loader.name, loader)
            mod = importlib.util.module_from_spec(spec)
            sys.modules[loader.name] = mod
            loader.exec_module(mod)
            return mod
    raise FileNotFoundError(f"manage_devices script not found under {SCRIPTS}")


@pytest.fixture()
def md(tmp_path):
    """A fresh manage_devices module wired to a fresh temp DB."""
    mod = load_manage_devices(tmp_path / "devices.db")
    yield mod
    if mod._conn is not None:
        mod._conn.close()


@pytest.fixture()
def no_sync(md, monkeypatch):
    """Neutralize sync() for cmd_* tests that must stay offline."""
    monkeypatch.setattr(md, "sync", lambda *a, **k: [])
    return md
