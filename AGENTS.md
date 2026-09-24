# AGENTS.md

This repository contains the snap packaging (and colocated YARF UI tests) for
the **gemini-desktop** snap, published by kenvandine.

## Automated maintenance

This repository is maintained in part by the `automated-ken` fleet-maintenance
system (https://github.com/kenvandine/automated-ken). Automated agents may:

- Open pull requests bumping the packaged application/runtime version
- Run the `YARF Snap Test` GitHub Actions workflow (`.github/workflows/snap-test.yml`)
  against candidate/edge builds before promoting a release
- Review and comment on PRs, including AI-assisted screenshot review of UI test
  results

## Tests

YARF UI test suites belong under `tests/suite/` in this repository. They are
executed via the `YARF Snap Test` workflow, dispatched by the automated-ken
dashboard with a target channel/architecture/revision. Test results (screenshots
and metadata) are uploaded as workflow run artifacts and fetched directly by the
dashboard.

## Conventions

- Do not remove `.github/workflows/snap-test.yml` or the `tests/suite/` directory;
  they are required for automated release validation.
- Redundant upstream-polling / sync-release workflows that duplicate automated-ken's
  own version-bump automation should be removed to avoid conflicting/duplicate PRs.
