# Contributing

Propose changes through a pull request to `main`. Check the calendar tests and
build both supported targets as described in the README. For layout changes,
include emulator screenshots for both supported watches.

The repository safeguards mirror the companion watchface project:
pull requests are required for `main`, bypass is disabled, review conversations
must be resolved, only squash merges are allowed, and `secrets`, `tests`, and
`build` checks must pass. The owner alone may update `main` through pull
requests and create tags; existing tags must not be changed or deleted.

Verify the active repository rules before relying on these safeguards; GitHub
plan and visibility changes can affect their availability. The checks are
defined in `.github/workflows/checks.yml`.

Do not commit credentials, private calendar data, or personal contact details.
Use a neutral no-reply commit identity and review the commit metadata before
pushing. An emulator does not establish physical-watch or live-provider behavior.
