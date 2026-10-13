import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import {
  classifyTask, isTrackedPrompt, dateKey, DEFAULT_SETTINGS, emptyDayRecord, addTask,
  buildView, tileCountForWidth, bigNumberRows, parseReportArgs, KIND_LABEL, KINDS,
} from './lib'
import type { DayRecord, Settings, Tab, Kind } from './lib'

const PANE = 'work-report'
const TITLE = 'WORK REPORT'

const GOLD = '#F2C46D'
const HAIRLINE = '#262B33'
const MUTED = '#7D8590'
const TEXT_COLOR = '#E6EDF3'
const ACCENT = '#4FA8E0'

const KIND_COLOR: Record<Kind, string> = {
  emails: '#4FA8E0',
  documents: '#9D7CF2',
  images: '#F28FB1',
  research: '#5FD0C0',
  other: '#7D8590',
}

const recordsState = atom(
  { plugin: 'work-report', key: 'records' } as const,
  {} as Record<string, DayRecord>,
)
const settingsState = atom({ plugin: 'work-report', key: 'settings' } as const, DEFAULT_SETTINGS)
const selectedTabState = atom({ plugin: 'work-report', key: 'selectedTab' } as const, 'today' as Tab)

const BAR_MAX = 20
const LEVELS = [' ', '▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

function settingsText(settings: Settings): string {
  return [
    `Rate: $${settings.rate}/hr`,
    ...KINDS.map(kind => `${KIND_LABEL[kind]}: ${settings.minutesByKind[kind]} min/task`),
  ].join('\n')
}

function barFor(count: number, maxCount: number): string {
  if (maxCount <= 0 || count <= 0) return ' '.repeat(BAR_MAX)

  const len = Math.max(1, Math.round((count / maxCount) * BAR_MAX))
  return '█'.repeat(len).padEnd(BAR_MAX, ' ')
}

function columnGlyphs(ratio: number): [string, string, string] {
  const level = Math.max(0, Math.min(24, Math.round(ratio * 24)))
  const bottom = LEVELS[Math.max(0, Math.min(8, level))]!
  const mid = LEVELS[Math.max(0, Math.min(8, level - 8))]!
  const top = LEVELS[Math.max(0, Math.min(8, level - 16))]!
  return [top, mid, bottom]
}

export const register: Register = on => {
  let pendingIsTracked = false
  let currentTurn: { turnId: string; calls: { tool: string; filePath?: string }[] } | null = null

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'report',
      description: 'Show finished tasks, hours saved and their estimated value',
    })

    const storedRecords = (await $.store.get('records')) as Record<string, DayRecord> | undefined
    const storedSettings = (await $.store.get('settings')) as Settings | undefined

    await update($, recordsState, () => storedRecords ?? {})
    await update($, settingsState, () => storedSettings ?? DEFAULT_SETTINGS)

    return next(e)
  })

  // Counting only typed prompts: remember whether the prompt that is about
  // to start a turn was the person's own Enter, on a fresh turn, not a
  // slash command. Consumed by the very next turn.start.
  on('prompt.submit', ($, e, next) => {
    pendingIsTracked = isTrackedPrompt({
      originKind: e.origin.kind,
      text: e.text,
      hasRunningTurn: e.turnId !== undefined,
    })

    return next(e)
  })

  on('turn.start', ($, e, next) => {
    currentTurn = pendingIsTracked ? { turnId: e.turnId, calls: [] } : null
    pendingIsTracked = false

    return next(e)
  })

  // Tally which tools the main loop's turn used; a subagent's own calls
  // (e.agentId set) never count toward the task that spawned it.
  on('tool.call', ($, e, next) => {
    if (e.agentId === undefined && currentTurn) {
      const input = e as unknown as Record<string, unknown>
      const filePath = typeof input.file_path === 'string' ? input.file_path : undefined
      currentTurn.calls.push({ tool: e.tool, filePath })
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const tracked = e.agentId === undefined ? currentTurn : null
    if (e.agentId === undefined) currentTurn = null

    const ran = await next(e)

    if (tracked && tracked.turnId === e.turnId && e.reason === 'answer') {
      const kind = classifyTask(tracked.calls)
      const model = e.usage?.model ?? 'unknown'
      const today = dateKey(new Date(await $.clock.now()))

      const base = (await read($, recordsState)) ?? {}
      const updatedDay = addTask(base[today] ?? emptyDayRecord(), kind, model)
      const updatedAll = { ...base, [today]: updatedDay }

      await update($, recordsState, () => updatedAll)
      await $.store.set('records', updatedAll)
    }

    return ran
  })

  on('command.run', { command: 'report' }, async ($, e) => {
    try {
      const parsed = parseReportArgs(e.args)

      if (parsed.kind === 'open') {
        // Answer right away; open the pane in the background.
        void $.ui.open({ id: PANE, title: 'Work Report' })
        return { text: 'Work Report pane opened.' }
      }

      if (parsed.kind === 'error') {
        return { text: parsed.message }
      }

      const current = (await read($, settingsState)) ?? DEFAULT_SETTINGS

      if (parsed.kind === 'list') {
        return { text: settingsText(current) }
      }

      const nextSettings: Settings = parsed.field === 'rate'
        ? { ...current, rate: parsed.value }
        : { ...current, minutesByKind: { ...current.minutesByKind, [parsed.field]: parsed.value } }

      await update($, settingsState, () => nextSettings)
      await $.store.set('settings', nextSettings)

      return { text: `Updated.\n${settingsText(nextSettings)}` }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return { text: `Work Report ran into a problem: ${message}` }
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Button } = $.ui.resolve(e)

    return (
      <Box>
        <Button
          key="open-work-report"
          label="Work Report"
          plain
          hotkey="w"
          onPress={() => void $.ui.open({ id: PANE, title: 'Work Report', focus: true })}
        />
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)

    const recordsHeld = (await read($, recordsState)) ?? {}
    const settingsHeld = (await read($, settingsState)) ?? DEFAULT_SETTINGS
    const tab = (await read($, selectedTabState)) ?? 'today'

    const recordsMap = new Map(Object.entries(recordsHeld))
    const view = buildView(tab, new Date(), recordsMap, settingsHeld)
    const width = e.props.bodyColumns
    const tileCount = tileCountForWidth(width)

    const goldWidth = Math.min(TITLE.length, width)
    const hairlineWidth = Math.max(0, width - goldWidth)

    const tabButton = (value: Tab, label: string, hotkey: string) => (
      <Button
        key={`tab-${value}`}
        label={label}
        hotkey={hotkey}
        variant={tab === value ? 'primary' : undefined}
        onPress={() => update($, selectedTabState, () => value)}
      />
    )

    const sectionHeading = (label: string) => (
      <Box flexDirection="column">
        <Text color={MUTED}>{label}</Text>
        <Text color={HAIRLINE}>{'─'.repeat(width)}</Text>
      </Box>
    )

    const bigNumber = (text: string) => {
      const rows = bigNumberRows(text)

      if (!rows) {
        return <Text bold color={GOLD}>{text}</Text>
      }

      return (
        <Box flexDirection="column">
          <Text bold color={GOLD}>{rows[0]}</Text>
          <Text bold color={GOLD}>{rows[1]}</Text>
          <Text bold color={GOLD}>{rows[2]}</Text>
        </Box>
      )
    }

    const tiles = [
      { label: 'HOURS SAVED (EST.)', text: view.estimate.hours.toFixed(1) },
      { label: 'TASKS DONE', text: String(view.tasksDone) },
      { label: "DOLLARS' WORTH (EST.)", text: Math.round(view.estimate.dollars).toLocaleString('en-US') },
    ]
    const tileRows: (typeof tiles)[] = []
    for (let i = 0; i < tiles.length; i += tileCount) tileRows.push(tiles.slice(i, i + tileCount))

    const maxKindCount = Math.max(1, ...view.byKind.map(row => row.count))
    const maxModelCount = Math.max(1, ...view.byModel.map(row => row.count))

    const chartBarWidth = tab === 'month' ? 1 : 3
    const chartBars = view.chart
    const maxChartValue = Math.max(1, ...chartBars.map(bar => bar.value))
    const chartRows: [string[], string[], string[]] = [[], [], []]
    const chartColors: string[] = []

    for (const bar of chartBars) {
      const ratio = bar.isFuture ? 0 : bar.value / maxChartValue
      const [top, mid, bottom] = columnGlyphs(ratio)
      const pad = (ch: string) => (chartBarWidth === 1 ? ch : ` ${ch} `)
      chartRows[0].push(pad(top))
      chartRows[1].push(pad(mid))
      chartRows[2].push(pad(bottom))
      chartColors.push(bar.isCurrent ? GOLD : bar.isFuture ? HAIRLINE : ACCENT)
    }

    return (
      <Box flexDirection="column" width={width}>
        <Text bold color={TEXT_COLOR}>{TITLE}</Text>
        <Box flexDirection="row">
          <Text color={GOLD}>{'━'.repeat(goldWidth)}</Text>
          <Text color={HAIRLINE}>{'─'.repeat(hairlineWidth)}</Text>
        </Box>

        <Box flexDirection="row" gap={1}>
          {tabButton('today', 'Today', '1')}
          {tabButton('week', 'Week', '2')}
          {tabButton('month', 'Month', '3')}
          {tabButton('year', 'Year', '4')}
        </Box>

        <Box flexDirection="row" justifyContent="space-between">
          <Text bold color={TEXT_COLOR}>{view.title}</Text>
          <Text dimColor>{view.rangeLabel}</Text>
        </Box>

        {view.isEmpty ? (
          <Text dimColor>Nothing finished yet today. Your first finished task shows up here.</Text>
        ) : (
          <Box flexDirection="column">
            {tileRows.map(row => (
              <Box flexDirection="row" gap={1}>
                {row.map(tile => (
                  <Box flexDirection="column" borderStyle="round" borderColor={HAIRLINE} paddingX={1} flexGrow={1}>
                    <Text color={MUTED}>{tile.label}</Text>
                    {bigNumber(tile.text)}
                  </Box>
                ))}
              </Box>
            ))}

            {sectionHeading('WHERE THE TIME WENT')}
            {view.byKind.map(row => (
              <Box flexDirection="row" justifyContent="space-between">
                <Box flexDirection="row" gap={1}>
                  <Text color={KIND_COLOR[row.kind]}>{barFor(row.count, maxKindCount)}</Text>
                  <Text color={TEXT_COLOR}>{KIND_LABEL[row.kind]}</Text>
                </Box>
                <Text dimColor>{row.count} - {row.hours.toFixed(1)}h</Text>
              </Box>
            ))}

            {sectionHeading('WHO DID THE WORK')}
            {view.byModel.map(row => (
              <Box flexDirection="row" justifyContent="space-between">
                <Box flexDirection="row" gap={1}>
                  <Text color={ACCENT}>{barFor(row.count, maxModelCount)}</Text>
                  <Text color={TEXT_COLOR}>{row.model}</Text>
                </Box>
                <Text dimColor>{row.count}</Text>
              </Box>
            ))}

            <Box flexDirection="column">
              {[0, 1, 2].map(r => (
                <Box flexDirection="row">
                  {chartBars.map((_bar, i) => (
                    <Text color={chartColors[i]}>{chartRows[r][i]}</Text>
                  ))}
                </Box>
              ))}
              {chartBarWidth > 1 && (
                <Box flexDirection="row">
                  {chartBars.map(bar => (
                    <Text dimColor={!bar.isCurrent} color={bar.isCurrent ? GOLD : undefined}>{bar.label}</Text>
                  ))}
                </Box>
              )}
            </Box>

            <Text dimColor>{view.summaryLine}</Text>
          </Box>
        )}
      </Box>
    )
  })
}
