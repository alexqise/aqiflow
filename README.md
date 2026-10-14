# Aqiflow

A native macOS task + calendar planner in the spirit of Akiflow, built with **Rust + Tauri 2** and a React UI. Local-first: everything is stored in SQLite on your Mac.

> Clean-room implementation: no code or assets from Akiflow are used.

## Features

- **Inbox / Today / Upcoming / Someday / Done** views, plus **Projects** and **Tags**
- **Natural-language quick add**: `Write report tomorrow 3pm for 1h #work @deep !1 every week`
  - dates & times (`tomorrow 3pm`, `next fri`, `in 2 days`), durations (`30m`, `1h30m`, `for 45 min`)
  - `#project` (auto-created if new), `@tag`, `!1/!2/!3` priority, `!goal`, recurrence (`daily`, `weekdays`, `every month`…), `someday`
- **Global quick capture**: ⇧⌘Space opens a floating quick-add window from anywhere in macOS (configurable)
- **Calendar time-blocking**: drag tasks from any list onto the day panel or the week calendar; move and resize blocks; drag to create events; overlapping items lay out side by side; daily load bars
- **Day / 3-day / Week** calendar with an unscheduled-task tray
- **Daily planning ritual** (⇧⌘P): review overdue → choose today's tasks against your capacity → time-block → start the day
- **Focus mode** with countdown timer, pause/skip/complete, mirrored in the menu bar
- **Menu bar item** showing the current/next calendar item or the running focus timer
- **Command bar** (⌘K): fuzzy search across tasks and every action
- Task details: notes, subtasks, priority (incl. *goal of the day*), duration estimates, recurring tasks, tags, projects
- Drag tasks onto sidebar items to reschedule / move them, drag to reorder lists
- Undo for completes and deletes (⌘Z), right-click context menus everywhere
- Light / dark / system theme, macOS vibrancy sidebar, overlay title bar
- JSON export / import

## Keyboard shortcuts

| | |
|---|---|
| ⌘K | Command bar |
| N / ⌘N | New task |
| ⇧⌘Space | Global quick add |
| ⇧⌘P | Plan your day |
| ⌘\\ | Toggle calendar panel |
| G then I/T/U/C/S/D | Go to Inbox/Today/Upcoming/Calendar/Someday/Done |
| J / K | Move selection |
| ↵ | Open task |
| E | Complete |
| T / M | Do today / tomorrow |
| S | Schedule… |
| Z | Someday |
| 1 2 3 0 | Priority high / medium / low / none |
| G G | Goal of the day |
| F | Focus |
| ⌫ | Delete |
| [ ] . | Calendar previous / next / today |
| ? | All shortcuts |

## Develop

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```

Outputs `src-tauri/target/release/bundle/macos/Aqiflow.app` and a `.dmg` in `bundle/dmg/`.

Data lives in `~/Library/Application Support/com.aqiflow.app/aqiflow.db`.

## Not included

Akiflow's cloud features — account sync, Gmail/Slack/Notion/Jira integrations, Google/Outlook calendar sync, team sharing — depend on its servers and are not reproduced here.
