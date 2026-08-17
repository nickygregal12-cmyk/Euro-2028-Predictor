"""Offline analytical layer for the AI Lab.

DuckDB over exported snapshots. Never the application database: Supabase
remains the production authority. See ``docs/ops/offline-analytics.md``.
"""
from __future__ import annotations

from .build import SnapshotError, build_analytics_database
from .queries import ANALYSES

__all__ = ["ANALYSES", "SnapshotError", "build_analytics_database"]
