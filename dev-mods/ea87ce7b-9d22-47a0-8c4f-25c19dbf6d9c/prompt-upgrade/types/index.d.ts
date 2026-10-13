export type Question = {
  id: string
  text: string
  options: string[]
}

export type RewrittenPrompt = {
  text: string
  additions: string[]
}

export type UpgradeStage =
  | 'input'
  | 'reading'
  | 'asking'
  | 'questions'
  | 'rewriting'
  | 'review'
  | 'error'

export type UpgradeSession = {
  original: string
  stage: UpgradeStage
  questions: Question[]
  answers: Record<string, string>
  rewritten?: RewrittenPrompt
  error?: string
  failedAt?: 'asking' | 'rewriting'
  editing?: boolean
  otherFor?: string
} | null

export type HistoryEntry = {
  id: string
  at: number
  original: string
  rewritten: string
  additions: string[]
}

export type ViewMode = 'current' | 'history'

declare module 'claude-code' {
  interface PluginState {
    'prompt-upgrade': {
      session: UpgradeSession
      auto: boolean
      history: HistoryEntry[]
      viewing: ViewMode
    }
  }
}
