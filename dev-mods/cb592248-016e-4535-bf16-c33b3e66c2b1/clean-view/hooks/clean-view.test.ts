// NOTE: the `claude` CLI installed on this machine (2.1.197) has no `plugin
// test` subcommand yet (function-hook plugins are a newer, early-access
// feature). These tests are written to the testing kit's documented shape
// but could not be run here — run `claude plugin test .` once the CLI is
// updated to confirm them.

import { expect, test } from 'claude-code/testing'

import { cleanName, PLAN_TOOL, PROGRESS_TOOL } from './clean-view'

test('cleanName strips backticked paths and trims long names', async () => {
  expect(cleanName('Build the pricing section in `src/Pricing.tsx`')).toBe('Build the pricing section in')

  const long = 'Do the thing that takes a very long time to describe in plain English for a person'
  expect(long.length).toBeGreaterThan(40)
  const cleaned = cleanName(long)
  expect(cleaned.length).toBeLessThanOrEqual(41)
  expect(cleaned.endsWith('…')).toBe(true)

  expect(cleanName('')).toBe('Working on it')
  expect(cleanName('`only/a/path.tsx`')).toBe('Working on it')
})

test('a to-do list plus a progress report renders done/active/upcoming rows', async ($, on) => {
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'Read your brand notes', status: 'completed', activeForm: 'Reading your brand notes' },
      { content: 'Build the pricing section', status: 'in_progress', activeForm: 'Building the pricing section' },
      { content: 'Add the contact form', status: 'pending', activeForm: 'Adding the contact form' },
      { content: 'Polish the footer', status: 'pending', activeForm: 'Polishing the footer' },
    ],
  })

  await $.tool.call({ tool: PROGRESS_TOOL, task: 'Build the pricing section', percent: 60 })

  for (const surface of ['terminal', 'desktop'] as const) {
    const drawn = await $.ui.render({ component: 'AbovePrompt', surface, props: { hasSurvey: false, isWorking: true, bodyColumns: 80 } })
    const text = JSON.stringify(drawn)

    expect(text).toContain('Read your brand notes')
    expect(text).toContain('Build the pricing section')
    expect(text).toContain('60')
    expect(text).toContain('Next')
    expect(text).toContain('Up next')
  }
})

test('a permission prompt shows Needs you', async $ => {
  await $.classic.Notification({ message: 'Permission needed', notification_type: 'permission' })

  const drawn = await $.ui.render({ component: 'AbovePrompt', surface: 'terminal', props: { hasSurvey: false, isWorking: true, bodyColumns: 80 } })
  expect(JSON.stringify(drawn)).toContain('Needs you')
})

test('/simple off hides the band down to the button', async $ => {
  await $.command.run({ command: 'simple', args: 'off' })

  const drawn = await $.ui.render({ component: 'AbovePrompt', surface: 'terminal', props: { hasSurvey: false, isWorking: false, bodyColumns: 80 } })
  const text = JSON.stringify(drawn)

  expect(text).toContain('Clean View: OFF')
  expect(text).not.toContain('Working')
})

test('plan_steps then report_progress(100) checks off step one and starts step two', async $ => {
  await $.tool.call({ tool: PLAN_TOOL, steps: ['Read the brief', 'Draft the outline', 'Write the summary'] })
  await $.tool.call({ tool: PROGRESS_TOOL, task: 'Read the brief', percent: 100 })

  const drawn = await $.ui.render({ component: 'AbovePrompt', surface: 'terminal', props: { hasSurvey: false, isWorking: true, bodyColumns: 80 } })
  const text = JSON.stringify(drawn)

  expect(text).toContain('Done')
  expect(text).toContain('Working')
})

test('any tool is denied before a plan exists and allowed after', async $ => {
  const before = await $.tool.call({ tool: 'Read', file_path: '/tmp/does-not-matter.txt' })
  expect(before.deny).toBeDefined()

  await $.tool.call({ tool: PLAN_TOOL, steps: ['Look at the file', 'Report back'] })

  const after = await $.tool.call({ tool: 'Read', file_path: '/tmp/does-not-matter.txt' })
  expect(after.deny).toBeUndefined()
})
