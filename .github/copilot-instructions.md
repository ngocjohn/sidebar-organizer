# Copilot instructions for `sidebar-organizer`

## Build, lint, and test commands

CI uses **Node 20** with **pnpm 10**.

| Task | Command | Notes |
| --- | --- | --- |
| Install deps | `pnpm install` | Matches the GitHub Actions workflows. |
| Lint all source | `pnpm run lint` | Runs `eslint src/ --ext .ts --fix`. |
| Lint one file | `pnpm exec eslint src/path/to/file.ts --fix` | Use this for a targeted check while editing. |
| Dev watch build | `pnpm start` | Rollup watch build; serves `dist/` on port `8235`. |
| Fast bundle build | `pnpm run rollup` | Writes the bundle to `build/sidebar-organizer.js`. |
| Full build | `pnpm run build` | Runs lint first, then Rollup. |

There is **no automated test script** in `package.json`, and the `test/` directory is a collection of manual JSON/YAML fixtures and local sandbox files rather than a runnable test suite. There is currently **no single-test command** to run.

## High-level architecture

- `src/index.ts` is only the module entrypoint. It imports `./sidebar-organizer` for side effects and checks whether the plugin was loaded as a frontend module. The actual singleton is created in `src/sidebar-organizer.ts` as `window.SidebarOrganizer = new SidebarOrganizer()`.
- `SidebarOrganizer` is the runtime core. It uses `home-assistant-query-selector` to wait for Home Assistant shell elements, listens for Home Assistant events, rewrites the sidebar DOM, injects grouped items/dividers, and applies styles with `home-assistant-styles-manager`.
- The config UI is a Lit dialog stack. `utilities/model/dialog-handler.ts` intercepts Home Assistant’s sidebar editing flow and opens the organizer dialog via `show-dialog`. The wrapper dialog (`sidebar-organizer-dialog` / `sidebar-organizer-dialog-wa`) hosts `sidebar-organizer-config-dialog`, which switches between the visual editor and raw YAML editor.
- Config loading is split between **browser localStorage** and an optional **`/local/sidebar-organizer.yaml`** file. `utilities/configs/fetcher.ts` decides the source, `utilities/configs/validators.ts` validates and may auto-correct storage-backed config, and `sidebar-organizer.ts` applies the resulting config to the live sidebar.
- Sidebar panel order and Home Assistant user sidebar settings are separate concerns. `utilities/compute-panels.ts` derives the effective panel order, while `utilities/model/store.ts` watches for dashboard/panel changes and updates stored order or triggers reload flows when the live HA sidebar changes underneath the plugin.

## Key conventions

- TypeScript path aliases are limited to `@types`, `@constants`, and `@utilities/*`. Component imports stay relative.
- This plugin is for **Home Assistant 2026.2+** and already contains version-specific branches for **2026.3+** dialog behavior. Preserve those guards instead of flattening them away.
- Do not treat Home Assistant’s built-in sidebar editor as the source of truth when the plugin is active. The code explicitly intercepts that flow, warns about synced HA sidebar settings, and may require clearing HA user data before Sidebar Organizer can take over.
- Reuse the existing event/dialog helpers (`HA_EVENT`, `fireEvent`, `showDialogSidebarOrganizer`, `DialogHandler`) instead of inventing new ad hoc DOM events or opening dialogs directly.
- If you add or change config fields, wire them through the full pipeline: `src/types/index.ts`, config fetch/validation/cleanup utilities, dialog/editor components, and the runtime application logic in `sidebar-organizer.ts`.
- Validation rules are opinionated: the default panel must not appear in custom groups or bottom items, hidden panels are folded back into config validation, and invalid storage config is auto-corrected where possible. Keep those behaviors consistent when changing config logic.
- `pnpm run lint` is not passive formatting; it auto-fixes and enforces `unused-imports` plus `perfectionist/sort-imports`. Keep imports sorted and remove dead imports instead of working around the rules.
- Generated outputs live in `dist/` for watch/dev and `build/` for release artifacts. Do not hand-edit generated bundle files.
- The README installation caveat matters for debugging: Home Assistant must load the plugin as a module through `frontend.extra_module_url`, and the HACS resource URL must not be duplicated. `src/index.ts` and the URL-comparison utilities assume that loading model.
- The `test/` fixtures are still useful when changing validation or YAML parsing logic, even though they are not an automated suite.
