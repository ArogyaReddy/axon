import { expect, test } from 'claude-code/testing'

const USAGE = {
  input_tokens: 0,
  output_tokens: 0,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
}

const PRESENTATION = { isFullscreen: false, columns: 80 }

function composerPrompt(text: string, extra: Record<string, unknown> = {}) {
  return {
    text,
    wait: false,
    origin: { kind: 'composer' as const },
    ...extra,
  }
}

function mockNoQuestionsThenRewrite($: any, on: any, rewrittenText: string) {
  let call = 0
  on('model.complete', () => {
    call += 1
    if (call === 1) {
      return { isAnswered: true, text: '{"questions":[]}', usage: USAGE }
    }
    return {
      isAnswered: true,
      text: JSON.stringify({ text: rewrittenText, additions: ['added a clear goal'] }),
      usage: USAGE,
    }
  })
  on('ui.open', () => ({ isPlaced: true }))
  on('prompt.fill', () => ({ isFilled: true }))
}

test('a slash command passes straight through, auto mode on or off', async ($, on) => {
  on('model.complete', () => ({ isAnswered: true, text: '{"questions":[]}', usage: USAGE }))
  await $.command.run({ command: 'better', args: 'on', origin: { kind: 'composer' }, presentation: PRESENTATION })

  const result: any = await $.prompt.submit(composerPrompt('/compact'))
  expect(result.text).toBe('/compact')
})

test('a short reply passes straight through even with automatic mode on', async ($, on) => {
  on('model.complete', () => ({ isAnswered: true, text: '{"questions":[]}', usage: USAGE }))
  await $.command.run({ command: 'better', args: 'on', origin: { kind: 'composer' }, presentation: PRESENTATION })

  const result: any = await $.prompt.submit(composerPrompt('keep going'))
  expect(result.text).toBe('keep going')
})

test('a prompt with an attachment passes straight through', async ($, on) => {
  on('model.complete', () => ({ isAnswered: true, text: '{"questions":[]}', usage: USAGE }))
  await $.command.run({ command: 'better', args: 'on', origin: { kind: 'composer' }, presentation: PRESENTATION })

  const result: any = await $.prompt.submit(
    composerPrompt('look at this', { attachments: [{ type: 'image' as const }] }),
  )
  expect(result.text).toBe('look at this')
})

test('a prompt sent mid-turn passes straight through', async ($, on) => {
  on('model.complete', () => ({ isAnswered: true, text: '{"questions":[]}', usage: USAGE }))
  await $.command.run({ command: 'better', args: 'on', origin: { kind: 'composer' }, presentation: PRESENTATION })

  const result: any = await $.prompt.submit(composerPrompt('also do this', { turnId: 'turn-1' }))
  expect(result.text).toBe('also do this')
})

test('a leading > forces a prompt through and strips the marker', async ($, on) => {
  on('model.complete', () => ({ isAnswered: true, text: '{"questions":[]}', usage: USAGE }))
  await $.command.run({ command: 'better', args: 'on', origin: { kind: 'composer' }, presentation: PRESENTATION })

  const result: any = await $.prompt.submit(composerPrompt('>send this exactly'))
  expect(result.text).toBe('send this exactly')
})

test('automatic mode is off by default: a plain prompt passes through untouched', async $ => {
  const result: any = await $.prompt.submit(composerPrompt('refactor the auth module'))
  expect(result.text).toBe('refactor the auth module')
})

test('/better on makes a plain composer prompt get intercepted', async ($, on) => {
  mockNoQuestionsThenRewrite($, on, 'please refactor the auth module')

  await $.command.run({ command: 'better', args: 'on', origin: { kind: 'composer' }, presentation: PRESENTATION })

  const result: any = await $.prompt.submit(composerPrompt('refactor the auth module'))
  expect(typeof result.drop).toBe('string')
  expect(result.text).toBe(undefined)
})

test('/better off turns automatic mode back off', async ($, on) => {
  on('model.complete', () => ({ isAnswered: true, text: '{"questions":[]}', usage: USAGE }))
  on('ui.open', () => ({ isPlaced: true }))

  await $.command.run({ command: 'better', args: 'on', origin: { kind: 'composer' }, presentation: PRESENTATION })
  await $.command.run({ command: 'better', args: 'off', origin: { kind: 'composer' }, presentation: PRESENTATION })

  const result: any = await $.prompt.submit(composerPrompt('refactor the auth module'))
  expect(result.text).toBe('refactor the auth module')
})

test('the mod never re-intercepts its own resubmission (no loop back into the pane)', async ($, on) => {
  on('model.complete', () => ({ isAnswered: true, text: '{"questions":[]}', usage: USAGE }))

  const result: any = await $.prompt.submit({
    text: 'the upgraded prompt',
    wait: false,
    origin: { kind: 'plugin', name: 'prompt-upgrade', asUser: true },
  })
  expect(result.text).toBe('the upgraded prompt')
})

test('/better with no window room drops the prompt and says so, instead of sending it untouched', async ($, on) => {
  on('model.complete', () => ({ isAnswered: true, text: '{"questions":[]}', usage: USAGE }))
  on('ui.open', () => ({ isPlaced: false, reason: 'too-narrow' }))
  let filled: string | undefined
  on('prompt.fill', ($2: any, e: any) => {
    filled = e.text
    return { isFilled: true }
  })

  await $.command.run({ command: 'better', args: 'on', origin: { kind: 'composer' }, presentation: PRESENTATION })

  const result: any = await $.prompt.submit(composerPrompt('refactor the auth module'))
  expect(typeof result.drop).toBe('string')
  expect(filled).toBe('refactor the auth module')
})
