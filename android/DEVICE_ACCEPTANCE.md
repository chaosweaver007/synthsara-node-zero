# SynthSara Android Launcher v0.1 — Device Acceptance Checklist

Use this checklist on a real Android device or emulator after CI produces a debug APK.

## 0. Preflight

- [ ] CI job `Android Launcher` is green for the commit being tested.
- [ ] Install the debug APK produced by that workflow run.
- [ ] Record Android version and device model.
- [ ] Record the tested commit SHA.
- [ ] Confirm Android currently has another working launcher available so rollback remains possible.

## 1. Normal app launch

- [ ] Open SynthSara from the normal app launcher before making it Home.
- [ ] Confirm the header says `Node Zero · Android shell v0.1`.
- [ ] Confirm Home, Sarah, Projects, and Apps navigation controls are visible.
- [ ] Confirm long Home/Projects/Apps pages scroll instead of clipping content.

Expected: SynthSara behaves like a normal app and does not require privileged setup.

## 2. Become the Home app

- [ ] Tap `Set SynthSara as Home`.
- [ ] Select SynthSara in Android's Home/default-app settings.
- [ ] Open another app.
- [ ] Press the device Home gesture/button.
- [ ] Confirm SynthSara opens instead of the previous launcher.
- [ ] Repeat from at least three different apps.

Expected: Home reliably returns to SynthSara without rebooting, rooting, flashing, or modifying Android.

## 3. Installed-app launching

- [ ] Open the Apps surface.
- [ ] Confirm installed launchable apps appear.
- [ ] Open at least five different apps from SynthSara.
- [ ] Confirm returning Home comes back to SynthSara.
- [ ] Confirm SynthSara itself is not duplicated in the app grid.

Expected: normal launcher activities open successfully; failure of one app does not crash SynthSara.

## 4. Local Projects persistence

- [ ] Create project `Launcher Test One`.
- [ ] Create a second project with a different name.
- [ ] Close SynthSara and reopen it.
- [ ] Confirm both project names remain.
- [ ] Long-press one project to remove it.
- [ ] Restart SynthSara and confirm the removed project stays removed.

Expected: low-sensitivity project labels persist in app-private storage.

## 5. Sarah online path

- [ ] Open Sarah while network access is available.
- [ ] Send a harmless test message.
- [ ] Confirm a response returns.
- [ ] Confirm the UI reports Gate status and memory write metadata when supplied by Genesis.
- [ ] Send a second message and confirm the visible transcript contains both turns during the same process lifetime.

Expected: requests use the configured HTTPS endpoint and the forced private/shadow envelope.

## 6. Sarah transcript ephemerality

- [ ] With a visible Sarah transcript, force-stop SynthSara from Android App info or otherwise terminate the process.
- [ ] Reopen SynthSara.
- [ ] Open Sarah.
- [ ] Confirm the prior transcript is gone.
- [ ] Confirm local Projects still remain.

Expected: Sarah transcript is process-memory only; project labels persist separately.

## 7. Offline degradation

- [ ] Disable Wi-Fi and mobile data, or use airplane mode.
- [ ] Open SynthSara.
- [ ] Open installed apps through the Apps surface.
- [ ] Create/remove a local project.
- [ ] Attempt to message Sarah and confirm failure is contained to the networked feature.
- [ ] Confirm the launcher remains usable and does not lose local Projects.
- [ ] Restore networking and confirm Sarah can recover without reinstalling the app.

Expected: network loss does not disable Home, Apps, or local Projects.

## 8. Permission audit

Open Android Settings → Apps → SynthSara → Permissions.

- [ ] Confirm no Contacts permission.
- [ ] Confirm no Calendar permission.
- [ ] Confirm no Microphone permission.
- [ ] Confirm no Location permission.
- [ ] Confirm no Files/Photos permission.
- [ ] Confirm no SMS or Call Log permission.
- [ ] Confirm no Accessibility service authorization is requested.
- [ ] Confirm no Device Admin authorization is requested.
- [ ] Confirm no notification-listener access is requested.

Expected: v0.1 has no optional device-data permission surface. INTERNET is a normal install-time permission and is not shown as a runtime permission prompt.

## 9. Rollback and uninstall

- [ ] Change Android's default Home app back to the previous launcher.
- [ ] Press Home and confirm the previous launcher opens normally.
- [ ] Open SynthSara as a normal app one more time.
- [ ] Uninstall SynthSara.
- [ ] Confirm the phone continues operating normally with the original launcher.

Expected: the experiment is fully reversible without device repair or reset.

## 10. Reality log

Record anything that feels slow, awkward, confusing, unnecessary, or missing while actually using the launcher.

- Friction:
- Missing context:
- Too many taps:
- Wrong assumptions:
- Privacy/consent concern:
- Feature wanted immediately:
- Feature that can wait:

Do not promote v0.1 beyond functional proof until the core checks above pass on a real device.
