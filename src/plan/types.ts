// plan.json の型定義。計画の中身はすべて plan.json にあり、コードはこの形だけを知っている。

export type IsoDate = string // "YYYY-MM-DD"
export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export interface Skill {
  id: string
  name: string
  color: string
}

export interface Phase {
  id: string
  name: string
  start: IsoDate
  end: IsoDate
  focus: string
  description: string
}

export interface MarkRules {
  circle: string
  doubleCircle: string
  weekTargetDays: number
  weekStartsOn: WeekdayKey
  note: string
}

export interface MinimumTask {
  id: string
  label: string
  minutes: number
  skill: string
  menuId: string | null
}

export interface Menu {
  id: string
  no: number
  name: string
  skill: string
  defaultMinutes: number
  when: string
  summary: string
  steps: string[]
  target?: string
  busyDay?: string
  tip?: string
  materialNote?: string
  evidence?: string
  questionTypes?: string[]
  topicsByPhase?: Record<string, string>
  materialIds: string[]
  copyTextIds: string[]
}

export interface ScheduleTask {
  id: string
  menuId: string | null
  label: string
  minutes: number
  optional?: boolean
  replacedOnMockDay?: boolean
}

export type WeekSchedule = Record<WeekdayKey, ScheduleTask[]>

export interface SpecialDay {
  date: IsoDate
  replaceTaskIds: string[]
  addTasks: ScheduleTask[]
}

export type MaterialType = 'book' | 'app' | 'podcast' | 'video' | 'youtube' | 'website' | 'ai' | 'lesson'

export interface Material {
  id: string
  name: string
  type: MaterialType
  publisher?: string
  skill: string
  purpose: string
  cost: string
  url: string | null
}

/** レベル表の自動判定。min 以上、max 未満。配列の条件はすべて満たす必要がある */
export interface LevelMatch {
  checkpoint?: string
  checkpointType?: CheckpointType
  key: string
  min?: number
  max?: number
}

export interface LevelRow {
  skill: string
  condition: string
  action: string
  match?: LevelMatch[]
}

export type ResultFieldKind = 'band' | 'percent' | 'number' | 'text'

export interface ResultField {
  key: string
  label: string
  kind: ResultFieldKind
}

export type CheckpointType = 'diagnosis' | 'test' | 'recording'

export interface Checkpoint {
  id: string
  date: IsoDate
  type: CheckpointType
  title: string
  howTo?: string
  resultFields?: ResultField[]
  target?: string
  onResult?: string
}

export interface RecordingCheck {
  howTo: string
  resultFields: ResultField[]
  target: string
}

export interface CopyText {
  id: string
  label: string
  text: string
}

export interface Title {
  fromLevel: number
  name: string
}

export interface Badge {
  id: string
  name: string
  rule: string
}

export interface Collection {
  id: string
  name: string
  source: string
}

export interface Gamification {
  xp: {
    perMinute: number
    source: string
    bonusDoubleCircleDay: number
    bonusWeekTargetMet: number
  }
  level: {
    formula: string
    examples: Record<string, number>
    note: string
  }
  titles: Title[]
  tree: Record<string, string>
  badges: Badge[]
  collections: Collection[]
}

export interface Plan {
  version: number
  title: string
  timezone: string
  dayBoundaryHour: number
  period: { start: IsoDate; end: IsoDate }
  skills: Skill[]
  phases: Phase[]
  markRules: MarkRules
  minimumTasks: MinimumTask[]
  menus: Menu[]
  schedule: Record<string, WeekSchedule>
  specialDays: SpecialDay[]
  materials: Material[]
  levelTable: LevelRow[]
  checkpoints: Checkpoint[]
  recordingCheck: RecordingCheck
  copyTexts: CopyText[]
  gamification: Gamification
}
