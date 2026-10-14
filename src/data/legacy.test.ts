import { describe, expect, it } from 'vitest'
import { unitsFromLegacyDone } from './legacy'

// 旧版の記録 (曜日ごとのタスクの完了リスト) を、分類ごとのチェック数に移す
describe('unitsFromLegacyDone', () => {
  it('分類ごとに時間を合計して10分単位に切り上げる', () => {
    // 再起動期の月曜: 単語15分、精聴25分、1分スピーチ20分
    expect(unitsFromLegacyDone('2026-10-12', ['vocab', 'listening', 'speech'], 10)).toEqual({ vocab: 2, listening: 3, speaking: 2 })
  })
  it('最低ラインのタスクも同じ分類に足す', () => {
    // 単語15分 + 単語の見直し10分 = 25分 → 3
    expect(unitsFromLegacyDone('2026-10-12', ['vocab', 'min-vocab', 'min-record'], 10)).toEqual({ vocab: 3, speaking: 1 })
  })
  it('政策英語はリーディング、楽しみ枠はリスニングに数え、振り返りは数えない', () => {
    expect(unitsFromLegacyDone('2026-10-13', ['policy'], 10)).toEqual({ reading: 2 })
    expect(unitsFromLegacyDone('2026-10-11', ['vocab-review', 'weekly-review', 'fun'], 10)).toEqual({ vocab: 1, listening: 3 })
  })
  it('模試の日は模試が TOEFL に入る', () => {
    expect(unitsFromLegacyDone('2027-02-13', ['mock', 'weak-practice'], 10)).toEqual({ toefl: 12 })
  })
  it('その日にないタスクは数えない', () => {
    expect(unitsFromLegacyDone('2026-10-12', ['eikaiwa', 'unknown'], 10)).toEqual({})
  })
})
