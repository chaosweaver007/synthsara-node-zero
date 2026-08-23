# SynthSara Android Launcher v0.1

This directory is the first native Android shell for SynthSara. It is intentionally small, reversible, and local-first.

## What works in this slice

- Registers as an Android `HOME` application so the user can select SynthSara as the default launcher.
- Enumerates normal launchable Android apps and opens them from the SynthSara Apps screen.
- Provides Home, Sarah, Projects, and Apps surfaces.
- Keeps project names in app-private `SharedPreferences` on the device.
- Keeps Sarah chat history only in process memory; the launcher does not persist the transcript.
- Sends Sarah requests to the existing Genesis O-Series Gate 0 endpoint using a forced privacy envelope:
  - `persona = sarah`
  - `consent_level = private`
  - `collective_learning = false`
  - `pipeline_mode = shadow`
- Requests only the Android `INTERNET` permission in v0.1. It does not request contacts, calendar, notifications, files, microphone, location, SMS, call logs, accessibility, device admin, or background surveillance capabilities.

## Existing architecture reused

The launcher is a new native device surface, not a replacement for the current system layers:

```text
Android device
  -> SynthSara Launcher (native HOME shell)
      -> local projects + installed-app launcher
      -> ephemeral Sarah session
          -> Genesis O-Series Gate 0
              -> constitutional context + UDS reflection
              -> metadata-only Witness Receipt
```

Node Zero's browser proof remains intact. Genesis remains the constitutional runtime. The launcher owns only native device UX and explicit local state until additional scopes are deliberately added.

## Open in Android Studio

1. Open the `android/` directory as a project.
2. Use JDK 17.
3. Install Android SDK 35 if Android Studio requests it.
4. Build and install the `app` module on an Android 8.0+ device or emulator.
5. Launch SynthSara once, choose **Set SynthSara as Home**, and select SynthSara in Android's Home app settings.
6. To leave the experiment, change the default Home app back to the previous launcher.

This project does not replace, flash, root, or modify Android itself.

## v0.1 acceptance checks

- Pressing Home can open SynthSara after it is selected as the default Home app.
- Apps screen lists installed launcher activities and can open them.
- Projects survive an app restart.
- Sarah can return a Genesis response over HTTPS when the Gate 0 service is reachable.
- Killing and reopening the process clears the visible Sarah transcript.
- Network failures do not erase local projects or interfere with launching Android apps.
- No optional device-data permissions appear in the manifest.

## Next slice

1. Add a proper encrypted local vault instead of expanding `SharedPreferences` beyond low-sensitivity project labels.
2. Add explicit scope cards for calendar, notifications, files, contacts, and microphone before any capability is requested.
3. Add local document/project retrieval and an Akasha index.
4. Add voice input only behind a foreground, one-shot consent action.
5. Add notification summaries without granting reply/action authority by default.
6. Add a signed/hash-chained local Witness implementation for launcher events.
7. Add endpoint abstraction so production can prefer a dedicated authenticated mobile gateway rather than coupling the client to a public shadow URL.

## Boundary

This is a functional launcher proof, not a production identity vault, secure messenger, autonomous agent, or replacement mobile operating system. Consequential device actions remain out of scope until each tool has explicit consent, audit, undo, and policy enforcement.
