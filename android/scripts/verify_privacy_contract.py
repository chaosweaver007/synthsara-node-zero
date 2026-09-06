#!/usr/bin/env python3
"""Static contract checks for the SynthSara Android launcher v0.1 privacy boundary."""

from __future__ import annotations

import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ANDROID_NS = "{http://schemas.android.com/apk/res/android}"


def fail(message: str) -> None:
    print(f"PRIVACY CONTRACT FAILED: {message}", file=sys.stderr)
    raise SystemExit(1)


def require_fragment(text: str, fragment: str, source: str) -> None:
    if fragment not in text:
        fail(f"missing required contract fragment in {source}: {fragment}")


def main() -> None:
    manifest_path = ROOT / "app/src/main/AndroidManifest.xml"
    genesis_path = ROOT / "app/src/main/java/org/synthsara/nodezero/launcher/GenesisClient.kt"
    main_activity_path = ROOT / "app/src/main/java/org/synthsara/nodezero/launcher/MainActivity.kt"

    manifest_root = ET.parse(manifest_path).getroot()
    permissions = {
        node.attrib.get(f"{ANDROID_NS}name")
        for node in manifest_root.findall("uses-permission")
    }
    permissions.discard(None)

    allowed_permissions = {"android.permission.INTERNET"}
    if permissions != allowed_permissions:
        fail(
            "manifest permissions changed; expected exactly "
            f"{sorted(allowed_permissions)}, found {sorted(permissions)}"
        )

    application = manifest_root.find("application")
    if application is None:
        fail("manifest has no application element")
    if application.attrib.get(f"{ANDROID_NS}allowBackup") != "false":
        fail("android:allowBackup must remain false")
    if application.attrib.get(f"{ANDROID_NS}usesCleartextTraffic") != "false":
        fail("android:usesCleartextTraffic must remain false")

    genesis = genesis_path.read_text(encoding="utf-8")
    for fragment in (
        '.put("persona", "sarah")',
        '.put("consent_level", "private")',
        '.put("collective_learning", false)',
        '.put("pipeline_mode", "shadow")',
        'BuildConfig.SARAH_GATEWAY_URL',
        'require(endpoint.protocol == "https")',
    ):
        require_fragment(genesis, fragment, genesis_path.name)

    main_activity = main_activity_path.read_text(encoding="utf-8")
    require_fragment(
        main_activity,
        "private val ephemeralSarahLog = mutableListOf<String>()",
        main_activity_path.name,
    )
    if "getSharedPreferences" in main_activity or "Room.databaseBuilder" in main_activity:
        fail("Sarah UI must not write transcript state to persistent storage in v0.1")

    print("SynthSara Android v0.1 privacy contract: PASS")


if __name__ == "__main__":
    main()
