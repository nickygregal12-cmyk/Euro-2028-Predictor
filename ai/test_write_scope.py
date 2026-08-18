"""The write-scope guard, and proof that it can fail.

A guard nobody has watched fail is a guard nobody knows works. The second test
plants the exact statement the guard exists to stop and requires it to be
caught, so the check cannot decay into one that passes because its pattern
stopped matching anything at all.
"""
from __future__ import annotations

import check_write_scope as guard


def test_package_writes_only_to_the_ai_schema() -> None:
    assert guard.violations() == []


def test_a_platform_write_is_caught(tmp_path, monkeypatch) -> None:
    planted = tmp_path / "planted.py"
    planted.write_text(
        'SQL = "update public.season_fixtures set home_score = 3"\n')
    monkeypatch.setattr(guard, "ROOT", tmp_path)

    found = guard.violations()

    assert len(found) == 1
    assert "public.season_fixtures" in found[0]
    assert "outside schema ai" in found[0]


def test_an_unqualified_write_is_caught(tmp_path, monkeypatch) -> None:
    """`insert into predictions` would resolve by search_path, not by intent."""
    planted = tmp_path / "planted.py"
    planted.write_text('SQL = "insert into predictions (id) values (1)"\n')
    monkeypatch.setattr(guard, "ROOT", tmp_path)

    found = guard.violations()

    assert len(found) == 1
    assert "names no schema" in found[0]


def test_an_upsert_conflict_clause_is_not_a_second_target(tmp_path,
                                                          monkeypatch) -> None:
    """`on conflict do update set` names no relation of its own."""
    planted = tmp_path / "planted.py"
    planted.write_text(
        'SQL = "insert into ai.fixtures (id) values (1) '
        'on conflict (id) do update set id = excluded.id"\n')
    monkeypatch.setattr(guard, "ROOT", tmp_path)

    assert guard.violations() == []


def test_a_write_inside_a_subpackage_is_caught(tmp_path, monkeypatch) -> None:
    """The guard reads subdirectories, not just the top level.

    It globbed `*.py` until `ai/analytics/` existed, which covered the whole
    package only for as long as the package was flat. A guard that silently
    stops reaching new code is worse than no guard, because the passing message
    keeps arriving.
    """
    nested = tmp_path / "analytics" / "deeper"
    nested.mkdir(parents=True)
    (nested / "planted.py").write_text(
        'SQL = "delete from public.predictions where id = 1"\n')
    monkeypatch.setattr(guard, "ROOT", tmp_path)

    found = guard.violations()

    assert len(found) == 1
    assert "public.predictions" in found[0]
    # Named by its path within the package, so the offending file is findable.
    assert "analytics/deeper/planted.py" in found[0].replace("\\", "/")


def test_the_locked_virtual_environment_is_not_treated_as_package_source(
        tmp_path, monkeypatch) -> None:
    """Dependency source under ai/.venv is installed input, not AI Lab code."""
    dependency = tmp_path / ".venv" / "lib" / "site-packages" / "dependency.py"
    dependency.parent.mkdir(parents=True)
    dependency.write_text('SQL = "update public.anything set value = 1"\n')
    monkeypatch.setattr(guard, "ROOT", tmp_path)

    assert guard.violations() == []
