use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub done: bool,
    pub done_at: Option<String>,
    /// Local calendar date, `YYYY-MM-DD`.
    pub date: Option<String>,
    /// Local datetime for a time block, `YYYY-MM-DDTHH:mm`.
    pub start: Option<String>,
    #[serde(default)]
    pub duration: i64,
    #[serde(default)]
    pub priority: i64,
    pub project_id: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub sort_order: f64,
    #[serde(default)]
    pub someday: bool,
    pub recurrence: Option<String>,
    #[serde(default)]
    pub subtasks: Vec<Subtask>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Subtask {
    pub id: String,
    pub title: String,
    pub done: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub name: String,
    pub color: String,
    #[serde(default)]
    pub sort_order: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CalEvent {
    pub id: String,
    pub title: String,
    pub start: String,
    pub end: String,
    #[serde(default)]
    pub all_day: bool,
    pub color: String,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub location: String,
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    pub tasks: Vec<Task>,
    pub projects: Vec<Project>,
    pub tags: Vec<Tag>,
    pub events: Vec<CalEvent>,
    pub settings: HashMap<String, String>,
}

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;
         CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            done INTEGER NOT NULL DEFAULT 0,
            done_at TEXT,
            date TEXT,
            start TEXT,
            duration INTEGER NOT NULL DEFAULT 0,
            priority INTEGER NOT NULL DEFAULT 0,
            project_id TEXT,
            tags TEXT NOT NULL DEFAULT '[]',
            sort_order REAL NOT NULL DEFAULT 0,
            someday INTEGER NOT NULL DEFAULT 0,
            recurrence TEXT,
            subtasks TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
         CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            sort_order REAL NOT NULL DEFAULT 0
         );
         CREATE TABLE IF NOT EXISTS tags (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            start TEXT NOT NULL,
            end TEXT NOT NULL,
            all_day INTEGER NOT NULL DEFAULT 0,
            color TEXT NOT NULL,
            notes TEXT NOT NULL DEFAULT '',
            location TEXT NOT NULL DEFAULT ''
         );
         CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
         );",
    )?;
    Ok(conn)
}

fn task_from_row(r: &Row) -> rusqlite::Result<Task> {
    let tags: String = r.get("tags")?;
    let subtasks: String = r.get("subtasks")?;
    Ok(Task {
        id: r.get("id")?,
        title: r.get("title")?,
        notes: r.get("notes")?,
        done: r.get::<_, i64>("done")? != 0,
        done_at: r.get("done_at")?,
        date: r.get("date")?,
        start: r.get("start")?,
        duration: r.get("duration")?,
        priority: r.get("priority")?,
        project_id: r.get("project_id")?,
        tags: serde_json::from_str(&tags).unwrap_or_default(),
        sort_order: r.get("sort_order")?,
        someday: r.get::<_, i64>("someday")? != 0,
        recurrence: r.get("recurrence")?,
        subtasks: serde_json::from_str(&subtasks).unwrap_or_default(),
        created_at: r.get("created_at")?,
        updated_at: r.get("updated_at")?,
    })
}

pub fn load_all(conn: &Connection) -> rusqlite::Result<AppData> {
    let mut data = AppData::default();

    let mut stmt = conn.prepare("SELECT * FROM tasks ORDER BY sort_order")?;
    data.tasks = stmt
        .query_map([], task_from_row)?
        .collect::<rusqlite::Result<_>>()?;

    let mut stmt = conn.prepare("SELECT id, name, color, sort_order FROM projects ORDER BY sort_order")?;
    data.projects = stmt
        .query_map([], |r| {
            Ok(Project { id: r.get(0)?, name: r.get(1)?, color: r.get(2)?, sort_order: r.get(3)? })
        })?
        .collect::<rusqlite::Result<_>>()?;

    let mut stmt = conn.prepare("SELECT id, name, color FROM tags ORDER BY name COLLATE NOCASE")?;
    data.tags = stmt
        .query_map([], |r| Ok(Tag { id: r.get(0)?, name: r.get(1)?, color: r.get(2)? }))?
        .collect::<rusqlite::Result<_>>()?;

    let mut stmt = conn.prepare(
        "SELECT id, title, start, end, all_day, color, notes, location FROM events ORDER BY start",
    )?;
    data.events = stmt
        .query_map([], |r| {
            Ok(CalEvent {
                id: r.get(0)?,
                title: r.get(1)?,
                start: r.get(2)?,
                end: r.get(3)?,
                all_day: r.get::<_, i64>(4)? != 0,
                color: r.get(5)?,
                notes: r.get(6)?,
                location: r.get(7)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;

    let mut stmt = conn.prepare("SELECT key, value FROM settings")?;
    data.settings = stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<rusqlite::Result<_>>()?;

    Ok(data)
}

pub fn save_task(conn: &Connection, t: &Task) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO tasks (id, title, notes, done, done_at, date, start, duration, priority, project_id,
            tags, sort_order, someday, recurrence, subtasks, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)
         ON CONFLICT(id) DO UPDATE SET
            title = excluded.title, notes = excluded.notes, done = excluded.done,
            done_at = excluded.done_at, date = excluded.date, start = excluded.start,
            duration = excluded.duration, priority = excluded.priority,
            project_id = excluded.project_id, tags = excluded.tags,
            sort_order = excluded.sort_order, someday = excluded.someday,
            recurrence = excluded.recurrence, subtasks = excluded.subtasks,
            updated_at = excluded.updated_at",
        params![
            t.id,
            t.title,
            t.notes,
            t.done as i64,
            t.done_at,
            t.date,
            t.start,
            t.duration,
            t.priority,
            t.project_id,
            serde_json::to_string(&t.tags).unwrap_or_else(|_| "[]".into()),
            t.sort_order,
            t.someday as i64,
            t.recurrence,
            serde_json::to_string(&t.subtasks).unwrap_or_else(|_| "[]".into()),
            t.created_at,
            t.updated_at,
        ],
    )?;
    Ok(())
}

pub fn delete_task(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM tasks WHERE id = ?1", [id])?;
    Ok(())
}

pub fn save_project(conn: &Connection, p: &Project) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO projects (id, name, color, sort_order) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color,
            sort_order = excluded.sort_order",
        params![p.id, p.name, p.color, p.sort_order],
    )?;
    Ok(())
}

pub fn delete_project(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("UPDATE tasks SET project_id = NULL WHERE project_id = ?1", [id])?;
    conn.execute("DELETE FROM projects WHERE id = ?1", [id])?;
    Ok(())
}

pub fn save_tag(conn: &Connection, t: &Tag) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO tags (id, name, color) VALUES (?1, ?2, ?3)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, color = excluded.color",
        params![t.id, t.name, t.color],
    )?;
    Ok(())
}

pub fn delete_tag(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    // Strip the tag id out of every task's JSON tag array.
    let mut stmt = conn.prepare("SELECT id, tags FROM tasks WHERE tags LIKE ?1")?;
    let rows: Vec<(String, String)> = stmt
        .query_map([format!("%{id}%")], |r| Ok((r.get(0)?, r.get(1)?)))?
        .collect::<rusqlite::Result<_>>()?;
    for (task_id, tags) in rows {
        let mut list: Vec<String> = serde_json::from_str(&tags).unwrap_or_default();
        list.retain(|t| t != id);
        conn.execute(
            "UPDATE tasks SET tags = ?1 WHERE id = ?2",
            params![serde_json::to_string(&list).unwrap_or_else(|_| "[]".into()), task_id],
        )?;
    }
    conn.execute("DELETE FROM tags WHERE id = ?1", [id])?;
    Ok(())
}

pub fn save_event(conn: &Connection, e: &CalEvent) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO events (id, title, start, end, all_day, color, notes, location)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, start = excluded.start,
            end = excluded.end, all_day = excluded.all_day, color = excluded.color,
            notes = excluded.notes, location = excluded.location",
        params![e.id, e.title, e.start, e.end, e.all_day as i64, e.color, e.notes, e.location],
    )?;
    Ok(())
}

pub fn delete_event(conn: &Connection, id: &str) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM events WHERE id = ?1", [id])?;
    Ok(())
}

pub fn get_setting(conn: &Connection, key: &str) -> rusqlite::Result<Option<String>> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0))
        .optional()
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )?;
    Ok(())
}
