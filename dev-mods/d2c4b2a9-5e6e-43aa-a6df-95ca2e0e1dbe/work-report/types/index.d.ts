// Self-contained: no import, no `export ... from`. Kept in sync by hand with
// the matching types in hooks/lib.ts (Kind, DayRecord, Settings, Tab).

export type WorkReportKind = 'emails' | 'documents' | 'images' | 'research' | 'other'

export type WorkReportDayRecord = {
  kinds: Record<WorkReportKind, number>
  models: Record<string, number>
}

export type WorkReportSettings = {
  rate: number
  minutesByKind: Record<WorkReportKind, number>
}

export type WorkReportTab = 'today' | 'week' | 'month' | 'year'

declare module 'claude-code' {
  interface PluginState {
    'work-report': {
      records: Record<string, WorkReportDayRecord>
      settings: WorkReportSettings
      selectedTab: WorkReportTab
    }
  }
}
