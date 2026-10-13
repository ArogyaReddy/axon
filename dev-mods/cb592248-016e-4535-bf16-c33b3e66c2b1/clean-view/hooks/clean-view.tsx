import { atom, read, update } from 'claude-code'
import type { On } from 'claude-code'

import type { Checklist, ChecklistTask } from '../types'

export const PLAN_TOOL = 'mcp__clean-view__plan_steps'
export const PROGRESS_TOOL = 'mcp__clean-view__report_progress'
const STORE_KEY = 'cleanViewEnabled'
const ALWAYS_ALLOWED = new Set(['ToolSearch', 'TodoWrite', 'TaskCreate', 'TaskUpdate', 'AskUserQuestion'])
const METER_WIDTH = 10

const INITIAL_CHECKLIST: Checklist = {
  title: '',
  phase: 'idle',
  tasks: [],
  needsYouReason: null,
  stuckReason: null,
  startedAt: null,
  finishedAt: null,
  isCollapsed: false,
}

const cleanViewEnabled = atom({ plugin: 'clean-view', key: 'cleanViewEnabled' } as const, true)
const checklist = atom({ plugin: 'clean-view', key: 'checklist' } as const, INITIAL_CHECKLIST)
const tick = atom({ plugin: 'clean-view', key: 'tick' } as const, 0)

const SYSTEM_SECTION = {
  id: 'clean-view:instructions',
  scope: 'session' as const,
  text: [
    'Clean View is on: the person sees a plain checklist instead of raw tool output, so every',
    'step name must read as plain English a non-technical person understands.',
    '',
    `- For every request, even a quick question, call the ${PLAN_TOOL} tool first (ToolSearch`,
    '  for it first if it is deferred). Lay out 2 to 8 short steps, in order.',
    `- Then call ${PROGRESS_TOOL} as real progress happens, and with percent 100 the moment a`,
    '  step finishes.',
    '- Write every step name under 40 characters, starting with a verb (for example "Build the',
    '  pricing section"). Never put file paths, file names, commands, code or tool names in a',
    '  step name.',
    '- If this session already offers TodoWrite or a task-tracking tool, you may use that to-do',
    `  list as the plan instead of calling ${PLAN_TOOL}.`,
  ].join('\n'),
}

export function cleanName(raw: unknown): string {
  let s = String(raw ?? '')
  s = s.replace(/`[^`]*`/g, ' ')
  s = s.replace(/\S*\/\S*/g, ' ')
  s = s.replace(/\b[\w.-]+\.(tsx?|jsx?|py|rb|go|rs|java|kt|c|cc|cpp|h|hpp|cs|php|json|ya?ml|md|sh|css|scss|html?|sql|swift)\b/gi, ' ')
  s = s.replace(/\s+/g, ' ').trim()
  if (s.length === 0) return 'Working on it'
  s = s.charAt(0).toUpperCase() + s.slice(1)
  if (s.length > 40) {
    const cut = s.slice(0, 40)
    const lastSpace = cut.lastIndexOf(' ')
    s = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + '…'
  }
  return s
}

function clampPercent(value: unknown): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function hasRealPlan(cl: Checklist): boolean {
  return cl.tasks.some(t => !t.id.startsWith('placeholder-'))
}

function mapErrorMessage(error: string | null, details: string | undefined): string {
  const text = (details ?? '').toLowerCase()

  switch (error) {
    case 'rate_limit':
      return 'you hit your usage limit, try again a little later'
    case 'overloaded':
      return "Claude's servers are busy, try again in a minute"
    case 'authentication_failed':
    case 'oauth_org_not_allowed':
    case 'account_on_hold':
    case 'verification_required':
    case 'billing_error':
    case 'cloud_credential_error':
      return 'type /login'
    case 'invalid_request':
      if (text.includes('context') || text.includes('too long') || text.includes('maximum')) {
        return 'type /compact and try again'
      }
      return 'something went wrong, try again'
    default:
      if (text.includes('network') || text.includes('econn') || text.includes('fetch failed') || text.includes('enotfound')) {
        return 'the internet connection dropped'
      }
      return 'something went wrong, try again'
  }
}

export function registerCleanView(on: On) {
  let tickHandle: { cancel: () => void } | null = null
  let consecutiveFailures = 0
  let activeTurnId: string | null = null
  let lastStopFailure: string | null = null
  let lastStopFailureDetails: string | undefined

  async function ensureTicking($: any) {
    const cl = await read($, checklist)
    const shouldTick = cl.phase === 'working' || cl.phase === 'needsYou' || cl.phase === 'stuck'

    if (shouldTick && !tickHandle) {
      tickHandle = $.clock.every(250, () => update($, tick, (n: number) => (n + 1) % 1_000_000))
    } else if (!shouldTick && tickHandle) {
      tickHandle.cancel()
      tickHandle = null
    }
  }

  async function setChecklist($: any, fn: (cl: Checklist) => Checklist) {
    await update($, checklist, fn)
    await ensureTicking($)
  }

  async function generateTitle($: any, turnId: string, promptText: string) {
    const r = await $.model.complete({
      model: 'haiku',
      prompt: `Name this job in 2 to 6 plain English words a non-technical person understands, starting with a verb. No punctuation besides spaces, no quotes. Job request:\n\n${promptText.slice(0, 2000)}`,
      effort: 'low',
      maxTokens: 20,
    })

    if (turnId !== activeTurnId) return
    if (r.isAnswered && r.text.trim()) {
      const title = cleanName(r.text.trim())
      await setChecklist($, cl => ({ ...cl, title }))
    }
  }

  async function toggle($: any) {
    const next = !(await read($, cleanViewEnabled))
    await update($, cleanViewEnabled, () => next)
    await $.store.set(STORE_KEY, next)
    $.ui.toast(next ? 'Clean View is on' : 'Clean View is off')
  }

  on('session.start', async ($, e, next) => {
    const stored = await $.store.get(STORE_KEY)
    await update($, cleanViewEnabled, () => (typeof stored === 'boolean' ? stored : true))

    await $.tool.register({
      name: 'plan_steps',
      description:
        'Lay out every step of this job up front as a short, plain-English checklist the person will see above the prompt. Call this first for every request, even a quick one.',
      inputSchema: {
        type: 'object',
        properties: {
          steps: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2,
            maxItems: 8,
            description: '2 to 8 short step names, in order, in plain English a non-technical person understands.',
          },
        },
        required: ['steps'],
      },
    })

    await $.tool.register({
      name: 'report_progress',
      description:
        'Report progress on the current checklist step. Call again with percent 100 the moment the step finishes, which starts the next step automatically.',
      inputSchema: {
        type: 'object',
        properties: {
          task: { type: 'string', description: 'The step name, as given to plan_steps.' },
          percent: { type: 'number', description: 'Progress on that step, 0 to 100.' },
        },
        required: ['task', 'percent'],
      },
    })

    await $.command.register({
      name: 'simple',
      description: 'Turn Clean View on or off',
      argumentHint: 'on|off',
    })

    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    const enabled = await read($, cleanViewEnabled)

    if (!enabled) return result

    return { sections: [...result.sections, SYSTEM_SECTION] }
  })

  on('command.run', { command: 'simple' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    let next: boolean

    if (arg === 'on') next = true
    else if (arg === 'off') next = false
    else if (arg === '') next = !(await read($, cleanViewEnabled))
    else return { text: 'Usage: /simple on|off' }

    await update($, cleanViewEnabled, () => next)
    await $.store.set(STORE_KEY, next)

    return { text: next ? 'Clean View is on.' : 'Clean View is off.' }
  })

  on('turn.start', async ($, e, next) => {
    const trimmed = (e.text ?? '').trim()
    const isNewJob = trimmed.length > 0 && !trimmed.startsWith('/')

    if (isNewJob) {
      activeTurnId = e.turnId
      consecutiveFailures = 0
      const now = await $.clock.now()
      const placeholders: ChecklistTask[] = [
        { id: 'placeholder-understand', name: 'Understand your request', status: 'active', percent: 0, hasReported: false },
        { id: 'placeholder-plan', name: 'Plan the steps', status: 'upcoming', percent: 0, hasReported: false },
      ]

      await setChecklist($, () => ({
        title: 'Working on it',
        phase: 'working',
        tasks: placeholders,
        needsYouReason: null,
        stuckReason: null,
        startedAt: now,
        finishedAt: null,
        isCollapsed: false,
      }))

      void generateTitle($, e.turnId, trimmed)
    } else {
      const cl = await read($, checklist)
      if (cl.phase === 'needsYou') {
        await setChecklist($, c => ({ ...c, phase: 'working', needsYouReason: null }))
      }
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    const cl = await read($, checklist)

    if (cl.phase === 'idle') return result

    const now = await $.clock.now()

    if (e.isAborted) {
      await setChecklist($, c => ({ ...c, phase: 'stopped', finishedAt: now }))
    } else if (e.reason === 'refusal') {
      await setChecklist($, c => ({ ...c, phase: 'stuck', stuckReason: "Claude couldn't help with that request", finishedAt: now }))
    } else if (e.reason === 'error') {
      const message = mapErrorMessage(lastStopFailure, lastStopFailureDetails)
      lastStopFailure = null
      lastStopFailureDetails = undefined
      await setChecklist($, c => ({ ...c, phase: 'stuck', stuckReason: message, finishedAt: now }))
    } else {
      const hasUnfinished = cl.tasks.some(t => t.status !== 'done')

      if (hasUnfinished) {
        await setChecklist($, c => ({ ...c, phase: 'needsYou', needsYouReason: 'Claude is waiting for your reply' }))
      } else {
        await setChecklist($, c => ({ ...c, phase: 'done', finishedAt: now }))
        $.clock.after(5000, () => update($, checklist, c => (c.phase === 'done' ? { ...c, isCollapsed: true } : c)))
      }
    }

    return result
  })

  on('classic.StopFailure', ($, e, next) => {
    lastStopFailure = e.error
    lastStopFailureDetails = e.error_details
    return next(e)
  })

  on('classic.Notification', async ($, e, next) => {
    await setChecklist($, cl => (cl.phase === 'idle' ? cl : { ...cl, phase: 'needsYou', needsYouReason: 'Claude needs your OK to continue' }))
    return next(e)
  })

  on('classic.PermissionDenied', async ($, e, next) => {
    consecutiveFailures = 0
    await setChecklist($, cl => (cl.phase === 'idle' ? cl : { ...cl, phase: 'stuck', stuckReason: 'you said no to a step, so Claude paused' }))
    return next(e)
  })

  async function servePlanSteps($: any, e: any) {
    const steps = Array.isArray(e.steps) ? e.steps : []
    const cleaned = steps.slice(0, 8).map(cleanName)

    if (cleaned.length < 2) {
      return { deny: 'plan_steps needs 2 to 8 short steps.' }
    }

    const tasks: ChecklistTask[] = cleaned.map((name: string, i: number) => ({
      id: `step-${i}`,
      name,
      status: i === 0 ? 'active' : 'upcoming',
      percent: 0,
      hasReported: false,
    }))

    await setChecklist($, cl => ({ ...cl, tasks, phase: cl.phase === 'idle' ? 'working' : cl.phase }))

    return { result: { content: [{ type: 'text', text: `Planned ${tasks.length} steps. The first one has started.` }] } }
  }

  async function serveReportProgress($: any, e: any) {
    const rawTask = e.task

    if (typeof rawTask !== 'string' || rawTask.trim() === '') {
      return { deny: 'report_progress needs a task name.' }
    }

    const name = cleanName(rawTask)
    const percent = clampPercent(e.percent)

    await setChecklist($, cl => {
      let tasks = cl.tasks
      let idx = tasks.findIndex(t => t.name === name)

      if (idx === -1) {
        tasks = tasks.map(t => (t.status === 'active' ? { ...t, status: 'done' as const, percent: 100, hasReported: true } : t))
        tasks = [...tasks, { id: `extra-${tasks.length}`, name, status: 'active', percent, hasReported: true }]
        idx = tasks.length - 1
      } else {
        tasks = tasks.map((t, i) => {
          if (i < idx) return { ...t, status: 'done' as const, percent: 100, hasReported: true }
          if (i === idx) return { ...t, status: percent >= 100 ? ('done' as const) : ('active' as const), percent, hasReported: true }
          if (i === idx + 1 && percent >= 100) return { ...t, status: 'active' as const }
          return t
        })
      }

      return { ...cl, tasks, phase: cl.phase === 'idle' ? 'working' : cl.phase }
    })

    return { result: { content: [{ type: 'text', text: `Progress noted: ${percent}%.` }] } }
  }

  // Every tool.call concern (serving our two tools, the plan-first gate, the
  // AskUserQuestion Needs-you state, and the failure/success bookkeeping)
  // lives in this one hook: registering several on the same event within one
  // plugin has no documented chaining order, so one hook avoids the risk.
  on('tool.call', async ($, e, next) => {
    const toolName = String(e.tool)
    const isSubagent = Boolean(e.agentId)

    if (toolName === PLAN_TOOL) return servePlanSteps($, e)
    if (toolName === PROGRESS_TOOL) return serveReportProgress($, e)

    if (!isSubagent && !ALWAYS_ALLOWED.has(toolName)) {
      const cl = await read($, checklist)

      if (!hasRealPlan(cl)) {
        return { deny: `Call the ${PLAN_TOOL} tool first to lay out this job as 2 to 8 plain-English steps, then try this tool again.` }
      }
    }

    const isAskQuestion = !isSubagent && toolName === 'AskUserQuestion'

    if (isAskQuestion) {
      await setChecklist($, cl => (cl.phase === 'idle' ? cl : { ...cl, phase: 'needsYou', needsYouReason: 'Claude has a question for you' }))
    }

    const ran = await next(e)

    if (toolName === 'TodoWrite') {
      const todos = Array.isArray((e as { todos?: unknown[] }).todos) ? (e as { todos: any[] }).todos : []
      const tasks: ChecklistTask[] = todos.map((t, i) => ({
        id: `todo-${i}`,
        name: cleanName(t.content),
        status: t.status === 'completed' ? 'done' : t.status === 'in_progress' ? 'active' : 'upcoming',
        percent: t.status === 'completed' ? 100 : 0,
        hasReported: t.status === 'completed',
      }))

      if (tasks.length > 0) {
        await setChecklist($, cl => ({ ...cl, tasks, phase: cl.phase === 'idle' ? 'working' : cl.phase }))
      }
    }

    if (!isSubagent) {
      const wasDenied = ran.deny !== undefined
      const failed = !wasDenied && ran.isError === true

      if (failed) {
        consecutiveFailures += 1
        if (consecutiveFailures >= 3) {
          await setChecklist($, cl => (cl.phase === 'idle' ? cl : { ...cl, phase: 'stuck', stuckReason: 'a step keeps failing, Claude is trying another way' }))
        }
      } else if (!wasDenied) {
        consecutiveFailures = 0
        await setChecklist($, cl =>
          cl.phase === 'stuck' || cl.phase === 'needsYou' ? { ...cl, phase: 'working', stuckReason: null, needsYouReason: null } : cl,
        )
      }
    }

    return ran
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const enabled = await read($, cleanViewEnabled)
    if (!enabled) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box display="none" />
  })

  on('ui.render', { component: 'ToolResult' }, async ($, e, next) => {
    const enabled = await read($, cleanViewEnabled)
    if (!enabled) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box display="none" />
  })

  on('ui.render', { component: 'ToolGroup' }, async ($, e, next) => {
    const enabled = await read($, cleanViewEnabled)
    if (!enabled) return next(e)
    const { Box } = $.ui.resolve(e)
    return <Box display="none" />
  })

  on('ui.render', { component: 'ToolProgress' }, async ($, e, next) => {
    const enabled = await read($, cleanViewEnabled)
    if (!enabled) return next(e)
    return next({ ...e, props: { ...e.props, hint: '' } })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)
    const enabled = await read($, cleanViewEnabled)

    const toggleButton = (
      <Button
        key="clean-view-toggle"
        label={`● Clean View: ${enabled ? 'ON' : 'OFF'}`}
        onPress={() => toggle($)}
      />
    )

    if (!enabled) {
      return (
        <Box justifyContent="flex-end">
          {toggleButton}
        </Box>
      )
    }

    const cl = await read($, checklist)

    if (cl.phase === 'idle') {
      return (
        <Box justifyContent="flex-end">
          {toggleButton}
        </Box>
      )
    }

    const tickVal = await read($, tick)

    let headerNode
    if (cl.phase === 'needsYou') {
      headerNode = (
        <Box>
          <Text bold inverse> Needs you </Text>
          <Text> {cl.needsYouReason ?? 'Claude needs your OK to continue'}</Text>
        </Box>
      )
    } else if (cl.phase === 'stuck') {
      headerNode = <Text>⚠ Stuck: {cl.stuckReason ?? 'something is blocking this step'}</Text>
    } else if (cl.phase === 'stopped') {
      headerNode = <Text>■ Stopped · {cl.title} · you pressed Esc</Text>
    } else if (cl.phase === 'done') {
      const took = formatDuration((cl.finishedAt ?? 0) - (cl.startedAt ?? 0))
      headerNode = <Text>✓ All done · {cl.title} · took {took}</Text>
    } else {
      const elapsed = (await $.clock.now()) - (cl.startedAt ?? 0)
      headerNode = <Text>{cl.title} · {formatDuration(elapsed)}</Text>
    }

    const headerRow = (
      <Box justifyContent="space-between">
        {headerNode}
        {toggleButton}
      </Box>
    )

    if (cl.phase === 'done' && cl.isCollapsed) {
      return (
        <Box flexDirection="column">
          {headerRow}
        </Box>
      )
    }

    const reserved = 2 + METER_WIDTH + 1 + 8 + 2
    const nameWidth = Math.max(10, e.props.bodyColumns - reserved)
    const firstUpcomingIndex = cl.tasks.findIndex(t => t.status === 'upcoming')

    const rows = cl.tasks.map((t, i) => {
      let icon: string
      let iconColor: boolean

      if (t.status === 'done') {
        icon = '✓'
        iconColor = true
      } else if (t.status === 'active') {
        icon = cl.phase === 'needsYou' ? '‖' : '▶'
        iconColor = false
      } else {
        icon = '○'
        iconColor = true
      }

      let meter: string
      if (t.status === 'done') {
        meter = '█'.repeat(METER_WIDTH)
      } else if (t.status === 'upcoming') {
        meter = '░'.repeat(METER_WIDTH)
      } else if (!t.hasReported) {
        const pos = tickVal % METER_WIDTH
        meter = Array.from({ length: METER_WIDTH }, (_, j) => (j === pos ? '█' : '░')).join('')
      } else {
        const filled = Math.round((t.percent / 100) * METER_WIDTH)
        meter = '█'.repeat(filled) + '░'.repeat(METER_WIDTH - filled)
      }

      let label: string
      if (t.status === 'done') label = 'Done'
      else if (t.status === 'active') label = t.hasReported ? `${t.percent}%` : 'Working'
      else label = i === firstUpcomingIndex ? 'Next' : 'Up next'

      const name = t.name.length > nameWidth ? t.name.slice(0, Math.max(1, nameWidth - 1)) + '…' : t.name
      const dimName = t.status !== 'active'

      return (
        <Box key={t.id}>
          <Text dimColor={iconColor}>{icon} </Text>
          <Box width={nameWidth}>
            <Text dimColor={dimName} bold={t.status === 'active'} wrap="truncate-end">
              {name}
            </Text>
          </Box>
          <Text dimColor={t.status !== 'active'}> {meter} </Text>
          <Text dimColor={t.status === 'done'}>{label}</Text>
        </Box>
      )
    })

    return (
      <Box flexDirection="column">
        {headerRow}
        <Box flexDirection="column">{rows}</Box>
      </Box>
    )
  })
}
