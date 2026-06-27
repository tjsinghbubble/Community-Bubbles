# scripts/helpers — shared internals for the dev tooling (manage_devices, testctl,
# local_bubble_health). Modules here take a connection / plain args and are
# import-side-effect-free (no DB open, no subprocess at import time).
