// Pure logic for the Work Report mod: no `$`, no drawing, fully unit-testable.

export const KINDS = ['emails', 'documents', 'images', 'research', 'other'] as const
export type Kind = (typeof KINDS)[number]

// Priority used when one task touched tools of more than one kind: the
// first kind in this list that the task touched wins.
const KIND_PRIORITY: readonly Kind[] = ['emails', 'documents', 'images', 'research', 'other']

export const KIND_LABEL: Record<Kind, string> = {
  emails: 'Emails',
  documents: 'Documents',
  images: 'Images and video',
  research: 'Research',
  other: 'Other',
}

const NAME_KEYWORDS: Record<Exclude<Kind, 'other'>, readonly string[]> = {
  emails: ['mail', 'gmail', 'outlook', 'smtp', 'imap'],
  documents: [
    'doc', 'docx', 'word', 'slide', 'pptx', 'powerpoint', 'ppt',
    'sheet', 'xlsx', 'excel', 'spreadsheet', 'pdf', 'notion',
  ],
  images: ['image', 'video', 'photo', 'picture', 'dalle', 'imagen', 'media'],
  research: [
    'websearch', 'web_search', 'webfetch', 'web_fetch', 'browser',
    'research', 'transcript', 'youtube',
  ],
}

const EXTENSION_KIND: Record<string, Kind> = {
  doc: 'documents', docx: 'documents', pdf: 'documents', ppt: 'documents',
  pptx: 'documents', xls: 'documents', xlsx: 'documents', csv: 'documents',
  png: 'images', jpg: 'images', jpeg: 'images', gif: 'images', webp: 'images',
  bmp: 'images', mp4: 'images', mov: 'images', webm: 'images', avi: 'images', mkv: 'images',
}

/** Classifies one tool call by its tool name and, when known, the file it touched. */
export function classifyTool(toolName: string, filePath?: string): Kind {
  const name = toolName.toLowerCase()

  for (const kind of KIND_PRIORITY) {
    if (kind === 'other') continue

    if (NAME_KEYWORDS[kind].some(keyword => name.includes(keyword))) {
      return kind
    }
  }

  if (filePath) {
    const ext = filePath.split('.').pop()?.toLowerCase()
    const kind = ext ? EXTENSION_KIND[ext] : undefined

    if (kind) return kind
  }

  return 'other'
}

export type ToolUse = { tool: string; filePath?: string }

/** Sorts one finished task into a single kind by every tool it used. */
export function classifyTask(calls: readonly ToolUse[]): Kind {
  const used = new Set(calls.map(call => classifyTool(call.tool, call.filePath)))

  for (const kind of KIND_PRIORITY) {
    if (used.has(kind)) return kind
  }

  return 'other'
}

export type PromptOriginKind =
  | 'composer' | 'bridge' | 'sdk' | 'task-notification' | 'scheduled-trigger'
  | 'peer' | 'peer-send-message' | 'projects-relay' | 'channel' | 'coordinator'
  | 'observer' | 'observer-activity' | 'auto-continuation' | 'unclassified'
  | 'slack-ping' | 'plugin'

/**
 * Whether a submitted prompt is "a prompt I typed": the user's own Enter
 * (at the terminal or through the Remote Control bridge), starting a fresh
 * turn (not a prompt folded into one already running), and not a slash
 * command.
 */
export function isTrackedPrompt(input: {
  originKind: PromptOriginKind
  text: string
  hasRunningTurn: boolean
}): boolean {
  const isUserTyped = input.originKind === 'composer' || input.originKind === 'bridge'

  return isUserTyped && !input.hasRunningTurn && !input.text.trimStart().startsWith('/')
}

export type DayRecord = {
  kinds: Record<Kind, number>
  models: Record<string, number>
}

export function emptyDayRecord(): DayRecord {
  return {
    kinds: { emails: 0, documents: 0, images: 0, research: 0, other: 0 },
    models: {},
  }
}

export function totalOf(record: DayRecord): number {
  return KINDS.reduce((sum, kind) => sum + record.kinds[kind], 0)
}

/** Returns a new record with one finished task added; never mutates its input. */
export function addTask(record: DayRecord, kind: Kind, model: string): DayRecord {
  return {
    kinds: { ...record.kinds, [kind]: record.kinds[kind] + 1 },
    models: { ...record.models, [model]: (record.models[model] ?? 0) + 1 },
  }
}

/** Adds several day records together into one (counts only, no dates). */
export function mergeRecords(records: readonly DayRecord[]): DayRecord {
  const out = emptyDayRecord()

  for (const record of records) {
    for (const kind of KINDS) out.kinds[kind] += record.kinds[kind]

    for (const [model, count] of Object.entries(record.models)) {
      out.models[model] = (out.models[model] ?? 0) + count
    }
  }

  return out
}

export type Settings = {
  rate: number
  minutesByKind: Record<Kind, number>
}

export const DEFAULT_SETTINGS: Settings = {
  rate: 50,
  minutesByKind: { emails: 10, documents: 30, images: 20, research: 25, other: 10 },
}

export type Estimate = { minutes: number; hours: number; dollars: number }

export function estimate(record: DayRecord, settings: Settings): Estimate {
  const minutes = KINDS.reduce(
    (sum, kind) => sum + record.kinds[kind] * settings.minutesByKind[kind],
    0,
  )
  const hours = minutes / 60

  return { minutes, hours, dollars: hours * settings.rate }
}

// --- Dates: always stepped at local noon, so a clock change never shifts
// the calendar date a day over or under. ---

function atLocalNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
}

export function addDays(date: Date, days: number): Date {
  const noon = atLocalNoon(date)
  noon.setDate(noon.getDate() + days)
  return noon
}

export function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** The date's ordinal day within its own calendar year (Jan 1 is 1). */
export function dayOfYear(date: Date): number {
  let days = date.getDate()

  for (let month = 0; month < date.getMonth(); month++) {
    days += daysInMonth(date.getFullYear(), month)
  }

  return days
}

/** The last `count` days up to and including `today`, oldest first. */
export function lastDays(today: Date, count: number): string[] {
  const out: string[] = []

  for (let i = count - 1; i >= 0; i--) out.push(dateKey(addDays(today, -i)))

  return out
}

export type Tab = 'today' | 'week' | 'month' | 'year'

/** The day keys (oldest first) whose records make up a tab's three tiles. */
export function tileDays(tab: Tab, today: Date): string[] {
  switch (tab) {
    case 'today': return [dateKey(today)]
    case 'week': return lastDays(today, 7)
    case 'month': return lastDays(today, 30)
    case 'year': return lastDays(today, dayOfYear(today))
  }
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export type Bar = { label: string; value: number; isCurrent: boolean; isFuture: boolean }

/** How many of each day's finished tasks the chart bars show for one tab. */
export function chartBars(tab: Tab, today: Date, countsByDay: ReadonlyMap<string, number>): Bar[] {
  if (tab === 'year') {
    const currentMonth = today.getMonth()
    const byMonth = new Array(12).fill(0) as number[]

    // Bounded to Jan 1 through today, so a stray record from another year
    // (or a future date) can never leak into a month's total.
    for (const key of lastDays(today, dayOfYear(today))) {
      const month = Number(key.split('-')[1]) - 1
      byMonth[month] = (byMonth[month] ?? 0) + (countsByDay.get(key) ?? 0)
    }

    return MONTH_LABELS.map((label, month) => ({
      label,
      value: month > currentMonth ? 0 : (byMonth[month] ?? 0),
      isCurrent: month === currentMonth,
      isFuture: month > currentMonth,
    }))
  }

  const days = tab === 'month' ? lastDays(today, 30) : lastDays(today, 7)

  return days.map(key => {
    const d = new Date(`${key}T12:00:00`)

    return {
      label: tab === 'month' ? String(d.getDate()) : WEEKDAY_LABELS[d.getDay()]!,
      value: countsByDay.get(key) ?? 0,
      isCurrent: key === dateKey(today),
      isFuture: false,
    }
  })
}

/** Consecutive days with at least one finished task, counting back from today. */
export function streak(today: Date, countsByDay: ReadonlyMap<string, number>): number {
  let count = 0

  for (let i = 0; ; i++) {
    const key = dateKey(addDays(today, -i))

    if ((countsByDay.get(key) ?? 0) <= 0) break

    count += 1
  }

  return count
}

export type BestBucket = { label: string; count: number } | null

/** The single busiest day (or, for Year, month) and how many had any activity. */
export function bestBucket(
  buckets: readonly { label: string; value: number }[],
): { best: BestBucket; activeCount: number } {
  let best: BestBucket = null
  let activeCount = 0

  for (const bucket of buckets) {
    if (bucket.value <= 0) continue

    activeCount += 1

    if (best === null || bucket.value > best.count) {
      best = { label: bucket.label, count: bucket.value }
    }
  }

  return { best, activeCount }
}

/** How many tiles fit at this pane width: three, then two, then one. */
export function tileCountForWidth(bodyColumns: number): 1 | 2 | 3 {
  if (bodyColumns >= 70) return 3
  if (bodyColumns >= 45) return 2
  return 1
}

export type ParsedCommand =
  | { kind: 'open' }
  | { kind: 'list' }
  | { kind: 'set'; field: 'rate' | Kind; value: number }
  | { kind: 'error'; message: string }

function isKind(value: string): value is Kind {
  return (KINDS as readonly string[]).includes(value)
}

/** Parses the text after `/report`: nothing, `settings`, or a settings change. */
export function parseReportArgs(args: string): ParsedCommand {
  const trimmed = args.trim()

  if (trimmed === '') return { kind: 'open' }

  const parts = trimmed.split(/\s+/)

  if (parts[0] !== 'settings') {
    return { kind: 'error', message: `Unknown command: /report ${trimmed}` }
  }

  if (parts.length === 1) return { kind: 'list' }

  const [, field, valueText] = parts

  if (field === undefined || valueText === undefined) {
    return {
      kind: 'error',
      message: 'Usage: /report settings <rate|emails|documents|images|research|other> <number>',
    }
  }

  const value = Number(valueText)

  if (!Number.isFinite(value) || value <= 0) {
    return { kind: 'error', message: `"${valueText}" is not a positive number` }
  }

  if (field === 'rate' || isKind(field)) {
    return { kind: 'set', field, value }
  }

  return { kind: 'error', message: `Unknown setting: ${field}` }
}

export type View = {
  title: string
  rangeLabel: string
  tasksDone: number
  estimate: Estimate
  byKind: { kind: Kind; count: number; hours: number }[]
  byModel: { model: string; count: number }[]
  chart: Bar[]
  summaryLine: string
  isEmpty: boolean
}

function formatDate(key: string): string {
  const d = new Date(`${key}T12:00:00`)
  return `${MONTH_LABELS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

/** Builds everything one tab's pane draws, from the stored per-day records alone. */
export function buildView(
  tab: Tab,
  today: Date,
  recordsByDay: ReadonlyMap<string, DayRecord>,
  settings: Settings,
): View {
  const days = tileDays(tab, today)
  const inRange = days.map(key => recordsByDay.get(key) ?? emptyDayRecord())
  const totals = mergeRecords(inRange)
  const tasksDone = totalOf(totals)
  const est = estimate(totals, settings)

  const byKind = KINDS
    .map(kind => ({
      kind,
      count: totals.kinds[kind],
      hours: (totals.kinds[kind] * settings.minutesByKind[kind]) / 60,
    }))
    .filter(row => row.count > 0)

  const byModel = Object.entries(totals.models)
    .map(([model, count]) => ({ model, count }))
    .sort((a, b) => b.count - a.count)

  const countsByDay = new Map(
    Array.from(recordsByDay.entries()).map(([key, record]) => [key, totalOf(record)] as const),
  )
  const chart = chartBars(tab, today, countsByDay)

  let rangeLabel: string
  let summaryLine: string

  if (tab === 'today') {
    rangeLabel = formatDate(days[0]!)
    summaryLine = `${streak(today, countsByDay)}-day streak`
  } else if (tab === 'week') {
    rangeLabel = `${formatDate(days[0]!)} - ${formatDate(days[days.length - 1]!)}`
    summaryLine = `${streak(today, countsByDay)}-day streak`
  } else if (tab === 'month') {
    rangeLabel = `${formatDate(days[0]!)} - ${formatDate(days[days.length - 1]!)}`
    // A full date, not the chart's bare day-of-month, since a 30-day window
    // can span two calendar months with the same day number.
    const dayBuckets = days.map(key => ({
      label: formatDate(key),
      value: totalOf(recordsByDay.get(key) ?? emptyDayRecord()),
    }))
    const { best, activeCount } = bestBucket(dayBuckets)
    summaryLine = best
      ? `Best day: ${best.label} (${best.count}) - ${activeCount} active days`
      : `${activeCount} active days`
  } else {
    rangeLabel = `${formatDate(days[0]!)} - ${formatDate(days[days.length - 1]!)}`
    const { best, activeCount } = bestBucket(chart)
    summaryLine = best
      ? `Best month: ${best.label} (${best.count}) - ${activeCount} active days`
      : `${activeCount} active days`
  }

  const title = tab.toUpperCase()

  return {
    title,
    rangeLabel,
    tasksDone,
    estimate: est,
    byKind,
    byModel,
    chart,
    summaryLine,
    isEmpty: tasksDone === 0,
  }
}

// --- Big numerals: each digit three rows tall, heavy box-drawing. ---

export const BIG_DIGITS: Record<string, readonly [string, string, string]> = {
  '0': ['┏━┓', '┃ ┃', '┗━┛'],
  '1': ['  ╻', '  ┃', '  ╹'],
  '2': ['╺━┓', '┏━┛', '┗━╸'],
  '3': ['╺━┓', ' ━┫', '╺━┛'],
  '4': ['╻ ╻', '┗━┫', '  ╹'],
  '5': ['┏━╸', '┗━┓', '╺━┛'],
  '6': ['┏━╸', '┣━┓', '┗━┛'],
  '7': ['╺━┓', '  ┃', '  ╹'],
  '8': ['┏━┓', '┣━┫', '┗━┛'],
  '9': ['┏━┓', '┗━┫', '╺━┛'],
  '.': ['  ', '  ', '╺╸'],
  ',': ['  ', '  ', '╻ '],
}

const BIG_DIGIT_MAX_CHARS = 5

/** Three rows of box-drawing glyphs for `text`, or null when it would not fit. */
export function bigNumberRows(text: string): readonly [string, string, string] | null {
  if (text.length > BIG_DIGIT_MAX_CHARS) return null
  if (![...text].every(ch => ch in BIG_DIGITS)) return null

  const rows: [string, string, string] = ['', '', '']

  for (const ch of text) {
    const glyph = BIG_DIGITS[ch]!

    for (let row = 0; row < 3; row++) rows[row] += (rows[row] ? ' ' : '') + glyph[row]
  }

  return rows
}
