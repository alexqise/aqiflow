# Aqiflow UI spec

Target look, measured from the reference app's dark theme at a 1512×949 pt window.
All sizes in CSS px (= macOS points). Colors are approximate eyedrops.

## Shell

| Area | Spec |
|---|---|
| Window chrome | `#232326`; everything that is not a content panel (title bar, rail, gutters) |
| Content panels | `#1b1b1c`, radius 8, 4px gap between panels and to the right/bottom window edge |
| Title bar | 40 tall, drag region. Traffic lights left. Centered **focus timer pill** 320×26: play icon, `25:00`, kebab; 1px `#3a3a3e` border, radius 6. Right: 3 icon buttons 29×29 |
| Icon rail | 57 wide. Item = 18px icon over 10px label, 57px pitch. Active item: 32×32 rounded (8) backing `#2f2f34`. Count badge: top-right of icon, `#3b3b40`, 10px bold white, radius 4. 1px divider after the primary group. Bottom: Search, More, 28px avatar circle |
| Task panel | 380 wide (collapsible with `«` in the calendar header) |
| Calendar panel | fills the rest |

## Task panel

- Header 46 tall: title 15px/600 + chevron-down; filter/options icon right.
- **Add new task** bar: 35 tall, margin 0 8px, 1px `#3a3a3e` border, radius 8; plus-in-circle icon, placeholder `#8e8e93`, right key hint `C` (16×16, `#3b3b40`, radius 3).
- Section header: 13px/500 lavender `#c4a3ff` label, count chip (`#2c2c30`, 11px gray), right-aligned total duration 11px `#8e8e93`.
- Task row: 38 tall, radius 6, no dividers. Hover/selected `#2a2a2e`.
  - Checkbox 15×15, radius 4, 1.5px `#8a8a8f` border.
  - Title 14px `#ececec`.
  - Right chips: 18 tall, radius 4, `#2c2c30`, 12px. Age chip for overdue tasks (`52d ago`) uses peach text `#f2d3a8`; duration chip white.
  - Optional subtitle line (source/notes) 12px `#8e8e93`, indented to the title.

## Calendar panel

- Header 46 tall: `«` (hide task list), month + year 15px/600, week chip `W46` (`#2c2c30`, 11px). Right: `T` (today), `‹` `›`, calendars toggle, view switch text button (`3 Days`), link, people.
- Day header row 36 tall: time-zone label in a 50px gutter (10px gray). Each day centered: weekday 12px/600 + date; today's date in a purple pill `#8b4ff7`, radius 4, white.
- All-day row 28 tall, 2px bottom border `#333`.
- Grid: hour height 96. Hour labels right-aligned in the gutter, 11px `#9a9a9f`. Hour lines `#2c2c2c`, day separators `#333`.
- Now line: label in gutter 11px/600 `#9d6bff`; 2px line `#c9b3f5` across today, `#3b2370` across other days; small tick at the left end.
- Events: solid fill (calendar color mixed ~35% into the panel bg, navy by default), radius 3, title 12px white, time 10px lilac-gray.

## Type

Inter (bundled), 13px base, antialiased.
