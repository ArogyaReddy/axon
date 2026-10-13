import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { HistoryEntry, Question, UpgradeSession } from '../types'

const PANE = 'better'
const SKIP = '__skip__'

const GOLD = '#F2C46D'
const HAIRLINE = '#262B33'
const MUTED = '#7D8590'
const TEXT = '#E6EDF3'
const GREEN = '#3DD68C'
const AMBER = '#E3B341'

const STEP_LABELS = ['Your prompt', 'Questions', 'Rewrite', 'Review']

const SHORT_REPLY =
  /^(y|ya|yes|yeah|yep|yup|ok|okay|sure|go|go ahead|continue|keep going|k|kk|no|nope|stop|cancel|thanks|thank you|please continue)[.!]?$/i

const QUESTIONS_SYSTEM_PROMPT = `You help turn a rough prompt for an AI coding agent into a great one.
Given the person's rough prompt, decide up to 3 multiple-choice questions whose answers would most
improve the result. Each question needs 2 to 4 short, concrete options. If the prompt is already clear
enough that no question would help, return an empty list.

Reply with ONLY compact JSON, no prose, no code fences, in exactly this shape:
{"questions":[{"id":"1","text":"...","options":["...","..."]}]}`

const REWRITE_SYSTEM_PROMPT = `You rewrite a rough prompt into one clear request the person could have
typed themselves, in plain language, as if written by them.

Rules:
- Keep exactly what they meant. Never change their intent.
- Add a clear goal, who it is for, the expected format, and what "done" looks like, where not already present.
- Use their answers to the clarifying questions where given; leave out anything they skipped.
- Never invent facts, names, numbers or prices. Where something is unknown, write [placeholder] in square brackets.
- Write it as a single request in plain language, not a list, not addressed back to them.

Reply with ONLY compact JSON, no prose, no code fences, in exactly this shape:
{"text":"the upgraded prompt","additions":["short phrase for one thing you added","..."]}`

const session = atom({ plugin: 'prompt-upgrade', key: 'session' } as const, null)
const auto = atom({ plugin: 'prompt-upgrade', key: 'auto' } as const, false)
const history = atom({ plugin: 'prompt-upgrade', key: 'history' } as const, [])
const viewing = atom({ plugin: 'prompt-upgrade', key: 'viewing' } as const, 'current')

function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length
}

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function parseJson(text: string): any {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')
  try {
    return JSON.parse(stripped)
  } catch {
    return null
  }
}

function describeModelFailure(r: { isAnswered: false; reason: string }): string {
  if (r.reason === 'api-error') return 'the model could not be reached.'
  if (r.reason === 'empty-reply') return 'the model sent back an empty reply.'
  return 'the request was interrupted.'
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'better',
      description: 'Upgrade a rough prompt before sending it',
      argumentHint: '[prompt | on | off | history]',
    })

    const stored = await $.store.get('history')
    if (Array.isArray(stored)) {
      await update($, history, () => stored as HistoryEntry[])
    }

    const current = await read($, session)
    if (current?.stage === 'asking') {
      void runPipeline($, current.original)
    } else if (current?.stage === 'rewriting') {
      void startRewrite($, current.original, current.answers)
    }

    return next(e)
  })

  on('command.run', { command: 'better' }, async ($, e) => {
    const args = e.args.trim()

    if (args === 'on') {
      await update($, auto, () => true)
      return { text: 'Prompt Upgrade: automatic mode is on.' }
    }
    if (args === 'off') {
      await update($, auto, () => false)
      return { text: 'Prompt Upgrade: automatic mode is off.' }
    }
    if (args === 'history') {
      await update($, viewing, () => 'history')
      const opened = await $.ui.open({
        id: PANE,
        title: 'Prompt Upgrade - History',
        focus: true,
        closeOnEscape: true,
        rows: 20,
      })
      return opened.isPlaced
        ? { text: 'Prompt Upgrade: history opened.' }
        : { text: 'Prompt Upgrade: the window is too narrow to show history here.' }
    }

    await update($, viewing, () => 'current')
    if (args.length === 0) {
      await update($, session, () => ({
        original: '',
        stage: 'input' as const,
        questions: [],
        answers: {},
      }))
      const opened = await $.ui.open({
        id: PANE,
        title: 'Prompt Upgrade',
        focus: true,
        closeOnEscape: true,
        rows: 10,
      })
      return opened.isPlaced
        ? { text: 'Prompt Upgrade: type a prompt to upgrade.' }
        : { text: 'Prompt Upgrade: the window is too narrow to open here.' }
    }

    const opened = await startUpgrade($, args)
    return opened.isPlaced
      ? { text: 'Prompt Upgrade: reviewing your prompt.' }
      : { text: 'Prompt Upgrade: the window is too narrow to open here; your words are back in the prompt box.' }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.origin.kind !== 'composer') return next(e)
    if (e.turnId) return next(e)
    if (e.attachments && e.attachments.length > 0) return next(e)

    const raw = e.text
    if (raw.startsWith('>')) return next({ ...e, text: raw.slice(1) })
    if (raw.startsWith('/')) return next(e)
    if (SHORT_REPLY.test(raw.trim())) return next(e)

    const isAuto = await read($, auto)
    if (!isAuto) return next(e)

    const opened = await startUpgrade($, raw)
    if (!opened.isPlaced) {
      return {
        drop:
          'Prompt Upgrade: the window is too narrow to open here; your words are back in the prompt box.',
      }
    }
    return { drop: 'Prompt Upgrade: reviewing your prompt.' }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (e.origin.kind === 'person') {
      const s = await read($, session)
      if (s) {
        await $.prompt.fill({ text: s.original, mode: 'replace' })
        await update($, session, () => null)
      }
    }
    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const elements = $.ui.resolve(e)
    const mode = await read($, viewing)
    if (mode === 'history') {
      return renderHistory(elements, await read($, history), $)
    }
    const current = await read($, session)
    return renderSession(elements, current, e.props.bodyColumns ?? 60, $, e.surface)
  })

  async function startUpgrade($: any, text: string) {
    await update($, viewing, () => 'current')
    await update($, session, () => ({
      original: text,
      stage: 'reading' as const,
      questions: [],
      answers: {},
    }))
    const opened = await $.ui.open({
      id: PANE,
      title: 'Prompt Upgrade',
      focus: true,
      closeOnEscape: true,
      rows: 24,
    })
    if (!opened.isPlaced) {
      await $.prompt.fill({ text, mode: 'replace' })
      await update($, session, () => null)
      return opened
    }
    void runPipeline($, text)
    return opened
  }

  async function runPipeline($: any, text: string) {
    await update($, session, s => (s ? { ...s, stage: 'asking' as const, error: undefined } : s))
    const r = await askQuestions($, text)
    if (!r.ok) {
      await update($, session, s =>
        s ? { ...s, stage: 'error' as const, error: r.error, failedAt: 'asking' as const } : s,
      )
      return
    }
    if (r.questions.length === 0) {
      await startRewrite($, text, {})
      return
    }
    await update($, session, s => (s ? { ...s, stage: 'questions' as const, questions: r.questions } : s))
  }

  async function askQuestions(
    $: any,
    text: string,
  ): Promise<{ ok: true; questions: Question[] } | { ok: false; error: string }> {
    const r = await $.model.complete({
      model: 'haiku',
      prompt: text,
      system: QUESTIONS_SYSTEM_PROMPT,
      maxTokens: 800,
      effort: 'low',
    })
    if (!r.isAnswered) return { ok: false, error: describeModelFailure(r) }
    const parsed = parseJson(r.text)
    if (!parsed || !Array.isArray(parsed.questions)) return { ok: true, questions: [] }
    const questions: Question[] = parsed.questions
      .slice(0, 3)
      .map((q: any, i: number) => ({
        id: String(q?.id ?? i),
        text: String(q?.text ?? '').slice(0, 200),
        options: Array.isArray(q?.options) ? q.options.slice(0, 4).map(String) : [],
      }))
      .filter((q: Question) => q.text.length > 0 && q.options.length >= 2)
    return { ok: true, questions }
  }

  async function startRewrite($: any, text: string, answers: Record<string, string>) {
    await update($, session, s =>
      s ? { ...s, stage: 'rewriting' as const, answers, error: undefined } : s,
    )
    const r = await askRewrite($, text, answers)
    if (!r.ok) {
      await update($, session, s =>
        s ? { ...s, stage: 'error' as const, error: r.error, failedAt: 'rewriting' as const } : s,
      )
      return
    }
    await update($, session, s => (s ? { ...s, stage: 'review' as const, rewritten: r.rewritten } : s))

    const entry: HistoryEntry = {
      id: makeId(),
      at: Date.now(),
      original: text,
      rewritten: r.rewritten.text,
      additions: r.rewritten.additions,
    }
    const nextHistory = await update($, history, list => [entry, ...list].slice(0, 20))
    await $.store.set('history', nextHistory)
  }

  async function askRewrite($: any, text: string, answers: Record<string, string>) {
    const current = await read($, session)
    const questions = current?.questions ?? []
    const lines = [`Rough prompt: ${text}`]
    for (const q of questions) {
      const a = answers[q.id]
      if (a && a !== SKIP) lines.push(`Q: ${q.text}\nA: ${a}`)
    }
    const r = await $.model.complete({
      model: 'haiku',
      prompt: lines.join('\n\n'),
      system: REWRITE_SYSTEM_PROMPT,
      maxTokens: 1200,
      effort: 'low',
    })
    if (!r.isAnswered) return { ok: false as const, error: describeModelFailure(r) }
    const parsed = parseJson(r.text)
    if (!parsed || typeof parsed.text !== 'string') {
      return { ok: false as const, error: 'the model did not reply in the expected shape.' }
    }
    return {
      ok: true as const,
      rewritten: {
        text: parsed.text,
        additions: Array.isArray(parsed.additions) ? parsed.additions.map(String) : [],
      },
    }
  }

  async function answerQuestion($: any, questionId: string, value: string) {
    const updated = await update($, session, s => {
      if (!s) return s
      return { ...s, answers: { ...s.answers, [questionId]: value }, otherFor: undefined }
    })
    if (
      updated &&
      updated.questions.length > 0 &&
      updated.questions.every(q => updated.answers[q.id] !== undefined)
    ) {
      await startRewrite($, updated.original, updated.answers)
    }
  }

  async function skipRestAndRewrite($: any) {
    const s = await read($, session)
    if (!s) return
    await startRewrite($, s.original, s.answers)
  }

  async function retry($: any) {
    const s = await read($, session)
    if (!s) return
    if (s.failedAt === 'rewriting') {
      await startRewrite($, s.original, s.answers)
    } else {
      await runPipeline($, s.original)
    }
  }

  async function runUpgrade($: any, surface: string, overrideText?: string) {
    const s = await read($, session)
    if (!s || !s.rewritten) return
    const text = overrideText ?? s.rewritten.text
    await $.prompt.submit({ text, asUser: true })
    await $.ui.close({ id: PANE })
    await update($, session, () => null)
  }

  async function sendOriginal($: any) {
    const s = await read($, session)
    if (!s) return
    await $.prompt.submit({ text: s.original, asUser: true })
    await $.ui.close({ id: PANE })
    await update($, session, () => null)
  }

  async function cancelUpgrade($: any) {
    const s = await read($, session)
    if (s) await $.prompt.fill({ text: s.original, mode: 'replace' })
    await $.ui.close({ id: PANE })
    await update($, session, () => null)
  }

  async function beginEdit($: any) {
    await update($, session, s => (s ? { ...s, editing: true } : s))
  }

  async function copyUpgrade($: any, surface: string) {
    const s = await read($, session)
    if (!s || !s.rewritten) return
    const r = await $.ui.copy({ text: s.rewritten.text, surface: surface as any })
    $.ui.toast(r.isCopied ? 'Copied the upgrade.' : 'Could not copy here.')
  }

  async function openHistoryEntry($: any, entry: HistoryEntry) {
    await update($, session, () => ({
      original: entry.original,
      stage: 'review' as const,
      questions: [],
      answers: {},
      rewritten: { text: entry.rewritten, additions: entry.additions },
    }))
    await update($, viewing, () => 'current')
  }

  function renderSession(
    elements: any,
    s: UpgradeSession,
    bodyColumns: number,
    $: any,
    surface: string,
  ) {
    const { Box, Text } = elements

    if (!s) {
      return (
        <Box flexDirection="column">
          {renderTitle(elements, 'PROMPT UPGRADE', bodyColumns)}
          <Text color={MUTED} dimColor>
            No upgrade in progress. Type /better followed by a rough prompt to start.
          </Text>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" gap={1}>
        {renderTitle(elements, 'PROMPT UPGRADE', bodyColumns)}
        {renderTracker(elements, s.stage)}
        {renderStage(elements, s, bodyColumns, $, surface)}
      </Box>
    )
  }

  function renderTitle(elements: any, title: string, bodyColumns: number) {
    const { Box, Text } = elements
    const goldWidth = Math.min(title.length, Math.max(1, bodyColumns))
    const restWidth = Math.max(0, bodyColumns - goldWidth)
    return (
      <Box flexDirection="column">
        <Text color={TEXT} bold>
          {title}
        </Text>
        <Box flexDirection="row">
          <Text color={GOLD}>{'─'.repeat(goldWidth)}</Text>
          <Text color={HAIRLINE}>{'─'.repeat(restWidth)}</Text>
        </Box>
      </Box>
    )
  }

  function renderHeading(elements: any, text: string, bodyColumns: number) {
    const { Box, Text } = elements
    return (
      <Box flexDirection="column">
        <Text color={MUTED}>{text.toUpperCase()}</Text>
        <Text color={HAIRLINE}>{'─'.repeat(Math.max(1, bodyColumns))}</Text>
      </Box>
    )
  }

  function renderTracker(elements: any, stage: string) {
    const { Box, Text } = elements
    const current = stageIndex(stage as string)
    return (
      <Box flexDirection="row" gap={2}>
        {STEP_LABELS.map((label, i) => {
          const color = i < current ? GREEN : i === current ? GOLD : MUTED
          const mark = i < current ? '✓' : String(i + 1)
          return (
            <Text key={label} color={color} bold={i === current}>
              {mark} {label}
            </Text>
          )
        })}
      </Box>
    )
  }

  function stageIndex(stage: string): number {
    if (stage === 'input' || stage === 'reading') return 0
    if (stage === 'asking' || stage === 'questions') return 1
    if (stage === 'rewriting') return 2
    return 3
  }

  function renderStage(elements: any, s: NonNullable<UpgradeSession>, bodyColumns: number, $: any, surface: string) {
    const { Box, Text, Input, Button } = elements
    const canInput = Boolean(Input)

    if (s.stage === 'input') {
      return (
        <Box flexDirection="column" gap={1}>
          <Text color={MUTED} dimColor>
            Type a rough prompt and press Enter to upgrade it.
          </Text>
          {canInput ? (
            <Input
              key="roughPrompt"
              placeholder="A rough prompt..."
              autoFocus
              submitLabel="upgrade"
              onSubmit={value => {
                const text = value.trim()
                if (text.length > 0) void startUpgrade($, text)
              }}
            />
          ) : (
            <Text color={MUTED} dimColor>
              Run /better followed by your prompt on this surface.
            </Text>
          )}
        </Box>
      )
    }

    if (s.stage === 'reading' || s.stage === 'asking' || s.stage === 'rewriting') {
      const message =
        s.stage === 'reading'
          ? 'Reading your prompt...'
          : s.stage === 'asking'
          ? 'Thinking of a few quick questions...'
          : 'Writing the upgrade...'
      return (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="column" borderStyle="round" borderColor={HAIRLINE} padding={1}>
            <Text color={TEXT}>{s.original}</Text>
          </Box>
          <Text color={MUTED} dimColor>
            {message}
          </Text>
        </Box>
      )
    }

    if (s.stage === 'questions') {
      const answeredCount = s.questions.filter(q => s.answers[q.id] !== undefined).length
      return (
        <Box flexDirection="column" gap={1}>
          {s.questions.map((q, i) => {
            const answer = s.answers[q.id]
            const isAnswered = answer !== undefined
            const badgeColor = isAnswered ? GREEN : GOLD
            const badge = isAnswered ? '✓' : String(i + 1)
            return (
              <Box key={q.id} flexDirection="column">
                <Box flexDirection="row" gap={1}>
                  <Text color={badgeColor} bold>
                    {badge}
                  </Text>
                  <Text color={TEXT}>{q.text}</Text>
                </Box>
                <Box flexDirection="row" gap={1}>
                  {q.options.map(opt => (
                    <Button
                      key={`${q.id}:${opt}`}
                      label={opt}
                      variant={answer === opt ? 'primary' : 'secondary'}
                      onPress={() => void answerQuestion($, q.id, opt)}
                    />
                  ))}
                  {canInput && (
                    <Button
                      key={`${q.id}:other`}
                      label="Other (type it)"
                      dimColor
                      variant={answer !== undefined && !q.options.includes(answer) && answer !== SKIP ? 'primary' : 'secondary'}
                      onPress={() => void update($, session, cur => (cur ? { ...cur, otherFor: q.id } : cur))}
                    />
                  )}
                  <Button
                    key={`${q.id}:skip`}
                    label="Skip"
                    plain
                    dimColor
                    onPress={() => void answerQuestion($, q.id, SKIP)}
                  />
                </Box>
                {canInput && s.otherFor === q.id && (
                  <Input
                    key={`${q.id}:otherInput`}
                    placeholder="Type your own..."
                    autoFocus
                    submitLabel="use this"
                    onSubmit={value => {
                      const text = value.trim()
                      void answerQuestion($, q.id, text.length > 0 ? text : SKIP)
                    }}
                  />
                )}
              </Box>
            )
          })}
          <Box flexDirection="row" justifyContent="space-between">
            <Text color={MUTED} dimColor>
              {answeredCount} of {s.questions.length} answered
            </Text>
            <Button
              label="Skip the rest, upgrade now"
              variant="primary"
              onPress={() => void skipRestAndRewrite($)}
            />
          </Box>
        </Box>
      )
    }

    if (s.stage === 'error') {
      return (
        <Box flexDirection="column" gap={1}>
          <Box flexDirection="column" borderStyle="round" borderColor={AMBER} padding={1}>
            <Text color={AMBER} bold>
              Something went wrong
            </Text>
            <Text color={TEXT}>Your prompt is safe: {s.error}</Text>
          </Box>
          <Box flexDirection="row" gap={1}>
            <Button label="Try again" variant="primary" onPress={() => void retry($)} />
            <Button label="Send my original" onPress={() => void sendOriginal($)} />
            <Button label="Cancel" plain dimColor onPress={() => void cancelUpgrade($)} />
          </Box>
        </Box>
      )
    }

    // review
    const rewritten = s.rewritten
    if (!rewritten) return <Text color={MUTED}>Nothing to review yet.</Text>

    const wordsBefore = countWords(s.original)
    const wordsAfter = countWords(rewritten.text)
    const addedCount = rewritten.additions.length
    const numbersColor = wordsAfter >= wordsBefore ? GREEN : TEXT

    return (
      <Box flexDirection="column" gap={1}>
        <Text color={numbersColor}>
          {wordsBefore} words → {wordsAfter} words · {addedCount} details added
        </Text>
        {s.editing && canInput ? (
          <Box flexDirection="row" gap={1}>
            <Button label="Cancel" plain dimColor onPress={() => void update($, session, cur => (cur ? { ...cur, editing: false } : cur))} />
          </Box>
        ) : (
          <Box flexDirection="row" gap={1}>
            <Button label="Run it" variant="primary" onPress={() => void runUpgrade($, surface)} />
            {canInput && <Button label="Edit" onPress={() => void beginEdit($)} />}
            <Button label="Copy" onPress={() => void copyUpgrade($, surface)} />
            <Button label="Cancel" plain dimColor onPress={() => void cancelUpgrade($)} />
          </Box>
        )}
        {rewritten.additions.length > 0 && (
          <Box flexDirection="column">
            {renderHeading(elements, 'What I added', bodyColumns)}
            {rewritten.additions.map(a => (
              <Text key={a} color={MUTED} dimColor>
                • {a}
              </Text>
            ))}
          </Box>
        )}
        {s.editing && canInput ? (
          <Box flexDirection="column" borderStyle="round" borderColor={GOLD} padding={1}>
            <Text color={MUTED}>UPGRADE (editing)</Text>
            <Input
              key="editUpgrade"
              value={rewritten.text}
              autoFocus
              submitLabel="run"
              onSubmit={value => void runUpgrade($, surface, value)}
            />
          </Box>
        ) : (
          <Box flexDirection="row" gap={2}>
            <Box flexDirection="column" width="50%" borderStyle="round" borderColor={HAIRLINE} padding={1}>
              <Text color={MUTED}>YOUR PROMPT</Text>
              <Text color={TEXT}>{s.original}</Text>
            </Box>
            <Box flexDirection="column" width="50%" borderStyle="round" borderColor={GOLD} padding={1}>
              <Text color={MUTED}>UPGRADE</Text>
              <Text color={TEXT}>{rewritten.text}</Text>
            </Box>
          </Box>
        )}
      </Box>
    )
  }

  function renderHistory(elements: any, entries: HistoryEntry[], $: any) {
    const { Box, Text, Button } = elements
    return (
      <Box flexDirection="column" gap={1}>
        {renderTitle(elements, 'PROMPT UPGRADE - HISTORY', 60)}
        <Button label="Back" plain dimColor onPress={() => void update($, viewing, () => 'current')} />
        {entries.length === 0 ? (
          <Text color={MUTED} dimColor>
            No upgrades yet.
          </Text>
        ) : (
          entries.map(entry => (
            <Button
              key={entry.id}
              label={entry.original.slice(0, 72)}
              onPress={() => void openHistoryEntry($, entry)}
            />
          ))
        )}
      </Box>
    )
  }
}
