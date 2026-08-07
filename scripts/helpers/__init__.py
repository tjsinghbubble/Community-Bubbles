# scripts/helpers — shared internals for the dev tooling (manage_devices, testctl).
# Modules here take a connection / plain args and are import-side-effect-free
# (no DB open, no subprocess at import time).
import importlib.machinery
import importlib.util
import sys
from pathlib import Path


def load_script(name):
    """Import a sibling scripts/ file as a module, extensionless or .py.

    The user-facing CLI entry points are extensionless (e.g. scripts/manage_devices),
    which a plain `import` statement cannot load; this wraps SourceFileLoader so
    tools (testctl, selftests, check_tooling) can keep importing them as modules.
    Results are cached in sys.modules under `name`.
    """
    if name in sys.modules:
        return sys.modules[name]
    scripts = Path(__file__).resolve().parent.parent
    for cand in (scripts / name, scripts / f"{name}.py"):
        if cand.exists():
            loader = importlib.machinery.SourceFileLoader(name, str(cand))
            spec = importlib.util.spec_from_loader(name, loader)
            assert spec is not None  # a SourceFileLoader always yields a spec
            mod = importlib.util.module_from_spec(spec)
            sys.modules[name] = mod
            loader.exec_module(mod)
            return mod
    raise ImportError(f"script {name!r} not found under {scripts}")
