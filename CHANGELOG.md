# Changelog

All notable changes to SockBot are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-06-12

Events are no longer set in stone — you can edit them after posting.

### Added
- **Edit Event:** posted events now have an ✏️ Edit button. The event creator (or any server manager) can update the title, description, start time, and duration without recreating the event. Changes re-render the event message in place and post an "event updated" notice in the event thread so signed-up players see what changed.
- Editing the start time automatically reschedules the reminder and cleanup timers, and renames the event thread to match the new title/date.
- **Delete Event:** posted events now have a 🗑️ Delete button next to Edit. The creator (or a server manager) can delete an event after confirming a prompt; this removes the event message and its thread and cancels pending reminders.

## [1.2.0] - 2026-06-11

Event creation gets more flexible ping targeting and a cleaner, more structured set of event types.

### Added
- Per-event ping role: `/create` now has a required `mention` field to pick exactly which role gets pinged when the event posts (e.g. `@raids`, `@static`, `@crushers`). The preview shows who will be notified before you commit, without pinging them.
- Per-template role toggles — required Yes/No fields that add special role(s) when selected: `squad` → Raid roles (Kite and Tank), `party` → Glut.

### Changed
- Streamlined event types to three, with clearer capacities: Party (5), Squad (10), Freeform (20).
- Command field order is now Title → Mention → Start, with each template's toggle right after.

### Removed
- **Breaking (command usage):** `fractal` and `raid` event types, replaced by the three templates above plus role toggles.
- **Breaking (command usage):** the free-text `custom-roles` option, superseded by structured per-template toggles.
- The `mention` fallback default — the `ROLE_ID_FRACTALS` / `ROLE_ID_RAIDS` / `ROLE_ID_CONTENT` env vars are no longer used.

### Internal
- Atomic, serialized event persistence — saves write to a temp file then rename (crash-safe) and are queued so concurrent signups can't corrupt `events.json`.
- Command registry — commands are registered and dispatched from a single list, so adding future commands is a one-line change.

## [1.1.1] - 2026-05-05

### Fixed
- Reset day words (e.g. "reset") are now interpreted in the selected timezone.
- General cleanup release.

## [1.1.0] - 2026-02-09

### Changed
- Moved server IDs to environment variables.

### Fixed
- Timezone parsing fixes and assorted bug cleanup.

### Added
- Documented bot permissions in the README.

[1.2.0]: https://github.com/lkpttn/sockbot/releases/tag/v1.2.0
