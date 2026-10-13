import { test, expect } from 'claude-code/testing'

import {
  classifyTask, isTrackedPrompt, streak, mergeRecords, dayOfYear, addDays, dateKey,
  buildView, tileCountForWidth, emptyDayRecord, addTask, DEFAULT_SETTINGS,
} from './lib'

// Sorting a task by its tools.

test('sorts a task by the tool it used', () => {
  expect(classifyTask([{ tool: 'Bash' }])).toBe('other')
  expect(classifyTask([{ tool: 'mcp__gmail__send_email' }])).toBe('emails')
  expect(classifyTask([{ tool: 'Write', filePath: 'report.pdf' }])).toBe('documents')
  expect(classifyTask([{ tool: 'WebSearch' }])).toBe('research')
  expect(classifyTask([{ tool: 'Write', filePath: 'chart.png' }])).toBe('images')
})

test('a task touching more than one kind is sorted by the higher-priority one', () => {
  expect(classifyTask([{ tool: 'WebSearch' }, { tool: 'mcp__gmail__send_email' }])).toBe('emails')
})

test('a task with no tools at all is Other', () => {
  expect(classifyTask([])).toBe('other')
})

// Counting only typed prompts.

test('counts the person\'s own typed prompt, at the terminal or through the bridge', () => {
  expect(isTrackedPrompt({ originKind: 'composer', text: 'summarize this', hasRunningTurn: false })).toBe(true)
  expect(isTrackedPrompt({ originKind: 'bridge', text: 'summarize this', hasRunningTurn: false })).toBe(true)
})

test('does not count a slash command', () => {
  expect(isTrackedPrompt({ originKind: 'composer', text: '/compact', hasRunningTurn: false })).toBe(false)
  expect(isTrackedPrompt({ originKind: 'composer', text: '  /compact now', hasRunningTurn: false })).toBe(false)
})

test('does not count a prompt folded into an already-running turn', () => {
  expect(isTrackedPrompt({ originKind: 'composer', text: 'go on', hasRunningTurn: true })).toBe(false)
})

test('does not count a notification, a peer or any other non-typed origin', () => {
  expect(isTrackedPrompt({ originKind: 'task-notification', text: 'done', hasRunningTurn: false })).toBe(false)
  expect(isTrackedPrompt({ originKind: 'scheduled-trigger', text: 'run it', hasRunningTurn: false })).toBe(false)
  expect(isTrackedPrompt({ originKind: 'plugin', text: 'from a plugin', hasRunningTurn: false })).toBe(false)
})

// The streak.

test('the streak counts consecutive active days back from today', () => {
  const today = new Date(2026, 9, 12, 12, 0, 0)
  const counts = new Map([
    ['2026-10-12', 2],
    ['2026-10-11', 1],
    ['2026-10-10', 1],
    ['2026-10-08', 3], // a gap on the 9th stops the streak here
  ])

  expect(streak(today, counts)).toBe(3)
})

test('the streak is zero once today itself has nothing finished', () => {
  const today = new Date(2026, 9, 12, 12, 0, 0)
  expect(streak(today, new Map())).toBe(0)
})

// Adding days together.

test('adding days together sums their kinds and their models', () => {
  const a = addTask(emptyDayRecord(), 'emails', 'sonnet')
  const b = addTask(addTask(emptyDayRecord(), 'emails', 'sonnet'), 'documents', 'opus')

  const total = mergeRecords([a, b])

  expect(total.kinds.emails).toBe(2)
  expect(total.kinds.documents).toBe(1)
  expect(total.models.sonnet).toBe(2)
  expect(total.models.opus).toBe(1)
})

test('adding days together never changes the days given to it', () => {
  const a = addTask(emptyDayRecord(), 'research', 'sonnet')
  const before = JSON.stringify(a)

  mergeRecords([a, emptyDayRecord()])

  expect(JSON.stringify(a)).toBe(before)
})

// The day of the year.

test('the day of the year counts from January 1st', () => {
  expect(dayOfYear(new Date(2026, 0, 1))).toBe(1)
  expect(dayOfYear(new Date(2026, 0, 31))).toBe(31)
  expect(dayOfYear(new Date(2026, 1, 1))).toBe(32)
})

test('the day of the year accounts for a leap day', () => {
  expect(dayOfYear(new Date(2024, 1, 29))).toBe(60)
  expect(dayOfYear(new Date(2024, 2, 1))).toBe(61)
})

test('stepping a day at local noon never skips or repeats a calendar date', () => {
  const start = new Date(2026, 2, 1, 12, 0, 0) // Mar 1, 2026
  expect(dateKey(addDays(start, 1))).toBe('2026-03-02')
  expect(dateKey(addDays(start, -1))).toBe('2026-02-28')
  expect(dateKey(addDays(start, 31))).toBe('2026-04-01')
})

// Each tab draws its own title and its own chart.

test('each tab has its own title', () => {
  const today = new Date(2026, 9, 12, 12, 0, 0)
  const empty = new Map()

  expect(buildView('today', today, empty, DEFAULT_SETTINGS).title).toBe('TODAY')
  expect(buildView('week', today, empty, DEFAULT_SETTINGS).title).toBe('WEEK')
  expect(buildView('month', today, empty, DEFAULT_SETTINGS).title).toBe('MONTH')
  expect(buildView('year', today, empty, DEFAULT_SETTINGS).title).toBe('YEAR')
})

test('each tab draws its own chart: 7 days, 7 days, 30 days, 12 months', () => {
  const today = new Date(2026, 9, 12, 12, 0, 0)
  const empty = new Map()

  expect(buildView('today', today, empty, DEFAULT_SETTINGS).chart.length).toBe(7)
  expect(buildView('week', today, empty, DEFAULT_SETTINGS).chart.length).toBe(7)
  expect(buildView('month', today, empty, DEFAULT_SETTINGS).chart.length).toBe(30)
  expect(buildView('year', today, empty, DEFAULT_SETTINGS).chart.length).toBe(12)
})

test('the year chart marks the current month gold and later months empty', () => {
  const today = new Date(2026, 9, 12, 12, 0, 0) // October
  const view = buildView('year', today, new Map(), DEFAULT_SETTINGS)

  expect(view.chart[9]!.isCurrent).toBe(true) // October, 0-indexed
  expect(view.chart[11]!.isFuture).toBe(true) // December has not happened yet
  expect(view.chart[11]!.value).toBe(0)
})

// The empty state.

test('a range with nothing finished is the empty state', () => {
  const today = new Date(2026, 9, 12, 12, 0, 0)
  const view = buildView('today', today, new Map(), DEFAULT_SETTINGS)

  expect(view.isEmpty).toBe(true)
  expect(view.tasksDone).toBe(0)
})

test('a range with one finished task is not the empty state', () => {
  const today = new Date(2026, 9, 12, 12, 0, 0)
  const records = new Map([[dateKey(today), addTask(emptyDayRecord(), 'research', 'sonnet')]])
  const view = buildView('today', today, records, DEFAULT_SETTINGS)

  expect(view.isEmpty).toBe(false)
  expect(view.tasksDone).toBe(1)
})

// A narrow width.

test('three tiles fit at a wide pane, two at a medium one, one at a narrow one', () => {
  expect(tileCountForWidth(120)).toBe(3)
  expect(tileCountForWidth(70)).toBe(3)
  expect(tileCountForWidth(69)).toBe(2)
  expect(tileCountForWidth(45)).toBe(2)
  expect(tileCountForWidth(44)).toBe(1)
  expect(tileCountForWidth(20)).toBe(1)
})
