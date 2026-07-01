from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest


@pytest.mark.skipif(shutil.which("kubectl") is None, reason="kubectl not available")
def test_kustomize_build_passes() -> None:
    """Ensure the K8s base kustomization builds without a cluster."""
    k8s_dir = Path(__file__).resolve().parent.parent / "k8s"
    result = subprocess.run(
        ["kubectl", "kustomize", str(k8s_dir)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, f"kubectl kustomize failed:\n{result.stderr}"
    assert result.stdout, "kubectl kustomize produced no output"
