#!/usr/bin/env python3
from __future__ import annotations

import builtins
import importlib.machinery
import json
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parent
switcher = importlib.machinery.SourceFileLoader(
    "vscode_settings_switcher", str(ROOT / "vscode-settings-templates")
).load_module()


def test_jsonc_and_structural_replacement() -> None:
    text = """{
  // \"editor.fontFamily\": \"commented\",\n
\t\"editor.fontFamily\": \"global\",\n
    \"[javascript]\": {\n
      \"editor.fontFamily\": \"scoped\"\n
    },\n
  \"workbench.colorCustomizations\": {\n
    // comment with } brace\n
    \"editor.background\": \"#000000\",\n
  },\n
}\n"""
    updated = switcher.replace_scalar_or_add(text, "editor.fontFamily", "new")
    assert '// "editor.fontFamily": "commented",' in updated
    assert '\t"editor.fontFamily": "new",' in updated
    assert '"editor.fontFamily": "scoped"' in updated
    trailing_comment = '{\n  "editor.fontFamily": "old", // keep this comment\n  "editor.minimap.enabled": false\n}\n'
    trailing_comment_updated = switcher.replace_scalar_or_add(trailing_comment, "editor.fontFamily", "new")
    assert '// keep this comment' in trailing_comment_updated
    trailing_comment_path = Path("/tmp/vscode-trailing-comment.jsonc")
    trailing_comment_path.write_text(trailing_comment_updated)
    try:
        assert switcher.load_jsonc(trailing_comment_path)["editor.fontFamily"] == "new"
    finally:
        trailing_comment_path.unlink()
    around_key = '{\n  "editor.fontFamily" /* key comment */ : /* value comment */ "old",\n}\n'
    around_key_updated = switcher.replace_scalar_or_add(around_key, "editor.fontFamily", "new")
    around_key_path = Path("/tmp/vscode-around-key.jsonc")
    around_key_path.write_text(around_key_updated)
    try:
        assert switcher.load_jsonc(around_key_path)["editor.fontFamily"] == "new"
    finally:
        around_key_path.unlink()
    missing_after_comment = '{\n  "existing": true // keep this comment\n}\n'
    missing_updated = switcher.replace_scalar_or_add(missing_after_comment, "editor.fontFamily", "new")
    assert '"existing": true, // keep this comment' in missing_updated
    assert missing_updated.index('"existing"') < missing_updated.index('"editor.fontFamily"')
    missing_path = Path("/tmp/vscode-missing-after-comment.jsonc")
    missing_path.write_text(missing_updated)
    try:
        assert switcher.load_jsonc(missing_path)["editor.fontFamily"] == "new"
    finally:
        missing_path.unlink()
    header_brace = '// header with { brace\n/* another { brace */\n{\n\t"existing": true\n}\n'
    header_updated = switcher.replace_scalar_or_add(header_brace, "editor.fontFamily", "new")
    header_path = Path("/tmp/vscode-header-brace.jsonc")
    header_path.write_text(header_updated)
    try:
        assert switcher.load_jsonc(header_path)["editor.fontFamily"] == "new"
    finally:
        header_path.unlink()
    four_space = '{\n    "existing": true\n}\n'
    four_space_updated = switcher.replace_scalar_or_add(four_space, "editor.fontFamily", "new")
    assert '\n    "editor.fontFamily": "new"' in four_space_updated
    four_space_existing = '{\n    "editor.fontFamily": "old"\n}\n'
    four_space_replaced = switcher.replace_scalar_or_add(four_space_existing, "editor.fontFamily", "new")
    assert four_space_replaced.count('"editor.fontFamily"') == 1
    four_space_existing_path = Path("/tmp/vscode-four-space-existing.jsonc")
    four_space_existing_path.write_text(four_space_replaced)
    try:
        assert switcher.load_jsonc(four_space_existing_path)["editor.fontFamily"] == "new"
    finally:
        four_space_existing_path.unlink()
    between_properties = '{\n  "first": true,\n  // between properties\n  "second": false\n}\n'
    between_updated = switcher.replace_scalar_or_add(between_properties, "editor.fontFamily", "new")
    between_path = Path("/tmp/vscode-between-properties.jsonc")
    between_path.write_text(between_updated)
    try:
        parsed_between = switcher.load_jsonc(between_path)
        assert parsed_between["second"] is False
        assert parsed_between["editor.fontFamily"] == "new"
    finally:
        between_path.unlink()
        object_last = '{\n    "workbench.colorCustomizations": {\n        "editor.background": "#000000"\n    }\n}\n'
        object_last_updated = switcher.replace_scalar_or_add(object_last, "editor.fontFamily", "new")
        object_last_path = Path("/tmp/vscode-object-last.jsonc")
        object_last_path.write_text(object_last_updated)
        try:
            assert switcher.load_jsonc(object_last_path)["editor.fontFamily"] == "new"
        finally:
            object_last_path.unlink()
        array_last = '{\n  "commands": ["one", "two"]\n}\n'
        array_last_updated = switcher.replace_scalar_or_add(array_last, "editor.fontFamily", "new")
        array_last_path = Path("/tmp/vscode-array-last.jsonc")
        array_last_path.write_text(array_last_updated)
        try:
            parsed_array = switcher.load_jsonc(array_last_path)
            assert parsed_array["commands"] == ["one", "two"]
            assert parsed_array["editor.fontFamily"] == "new"
        finally:
            array_last_path.unlink()
        colors_indented = switcher.replace_object(object_last, "workbench.colorCustomizations", {"editor.background": "#FFFFFF"})
        assert '\n        "editor.background"' in colors_indented
    updated = switcher.replace_object(updated, "workbench.colorCustomizations", {"editor.background": "#FFFFFF"})
    with tempfile.NamedTemporaryFile(mode="w", suffix=".jsonc", delete=False) as fixture:
        fixture.write(updated)
        fixture_path = Path(fixture.name)
    try:
        assert switcher.load_jsonc(fixture_path)["workbench.colorCustomizations"]["editor.background"] == "#FFFFFF"
        assert switcher.load_jsonc(fixture_path)
    finally:
        fixture_path.unlink()

    trailing = Path(tempfile.mkstemp(suffix=".jsonc")[1])
    trailing.write_text('{"setting": "comma, inside",}\n')
    try:
        assert switcher.load_jsonc(trailing) == {"setting": "comma, inside"}
    finally:
        trailing.unlink()


def test_backup_uniqueness_and_restore_filter() -> None:
    template = switcher.load_jsonc(ROOT / "templates/template-1-neutral-charcoal.jsonc")
    with tempfile.TemporaryDirectory() as directory:
        directory_path = Path(directory)
        settings_path = directory_path / "settings.json"
        backup_dir = directory_path / "backups"
        settings_path.write_text(json.dumps(template, indent=2))
        switcher.apply_template(settings_path, ROOT / "templates/template-1-neutral-charcoal.jsonc", backup_dir, False)
        switcher.apply_template(settings_path, ROOT / "templates/template-1-neutral-charcoal.jsonc", backup_dir, False)
        generated_backups = list(backup_dir.glob("settings-[0-9]*.json"))
        assert len(generated_backups) == 2
        for generated_backup in generated_backups:
            generated_backup.unlink()
        numeric_backup = backup_dir / "settings-20990101-000000-000000.json"
        numeric_backup.write_text(json.dumps({"restored": True}))
        restore_snapshot = backup_dir / "settings-before-restore-20990101-000000-000000.json"
        restore_snapshot.write_text(json.dumps({"wrong": True}))
        original_input = builtins.input
        builtins.input = lambda _prompt: "y"
        try:
            switcher.restore_latest(settings_path, backup_dir)
        finally:
            builtins.input = original_input
        assert json.loads(settings_path.read_text()) == {"restored": True}


if __name__ == "__main__":
    test_jsonc_and_structural_replacement()
    test_backup_uniqueness_and_restore_filter()
    print("CLI regression tests passed")