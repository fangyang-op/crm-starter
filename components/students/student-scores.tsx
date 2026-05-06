import { ScoreList, type ScoreListItem } from '@/components/students/scores/score-list'
import type { ScoreType } from '@/lib/constants/score-type'
import { createClient } from '@/lib/supabase/server'

type Props = {
  studentId: string
  canEdit: boolean
}

export async function StudentScores({ studentId, canEdit }: Props) {
  const supabase = createClient()

  const { data: rows } = await supabase
    .from('academic_scores')
    .select(
      'id, score_type, total_score, sub_scores, test_date, expiry_date, ' +
        'is_official, notes, certificate_storage_path, created_at',
    )
    .eq('student_id', studentId)
    .order('test_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  const raw = (rows ?? []) as unknown as Array<{
    id: string
    score_type: string
    total_score: string | null
    sub_scores: Record<string, string | number | null> | null
    test_date: string | null
    expiry_date: string | null
    is_official: boolean | null
    notes: string | null
    certificate_storage_path: string | null
    created_at: string
  }>
  const scores: ScoreListItem[] = raw.map((r) => ({
    id: r.id,
    score_type: r.score_type as ScoreType,
    total_score: r.total_score,
    sub_scores: r.sub_scores,
    test_date: r.test_date,
    expiry_date: r.expiry_date,
    is_official: Boolean(r.is_official),
    notes: r.notes,
    certificate_storage_path: r.certificate_storage_path,
    created_at: r.created_at,
  }))

  return <ScoreList studentId={studentId} scores={scores} canEdit={canEdit} />
}
