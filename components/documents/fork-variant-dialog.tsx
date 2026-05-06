'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { GitFork } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { forkVariant } from '@/app/(dashboard)/students/[id]/documents/actions'

export type ForkApplicationOption = {
  application_id: string
  school_name: string
  program_name: string | null
  already_forked: boolean
}

type Props = {
  studentId: string
  masterId: string
  sourceMasterVersionId: string
  applications: ForkApplicationOption[]
  trigger: React.ReactNode
}

export function ForkVariantDialog({
  studentId,
  masterId,
  sourceMasterVersionId,
  applications,
  trigger,
}: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [appId, setAppId] = useState('')

  const eligible = applications.filter((a) => !a.already_forked)

  const submit = () => {
    if (!appId) {
      toast.error('請選擇申請學校')
      return
    }
    startTransition(async () => {
      const r = await forkVariant(studentId, {
        master_id: masterId,
        application_id: appId,
        source_master_version_id: sourceMasterVersionId,
      })
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('已 Fork 成 Variant(不扣字數)')
      setOpen(false)
      setAppId('')
      router.push(`/students/${studentId}/documents/${masterId}/variants/${r.id}`)
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setAppId('')
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fork to School</DialogTitle>
          <DialogDescription>
            複製當前 Master 內容到指定的學校申請,產出客製版(Variant)。Fork 本身**不扣字數**, 後續
            Variant 編輯才會扣。
          </DialogDescription>
        </DialogHeader>

        {applications.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            這位學生目前沒有 application — 需要先到選校表把版本「展開為申請項」(Phase 4), 或在 SQL
            直接 INSERT 一筆 application。
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>選擇申請學校</Label>
              <Select value={appId} onValueChange={setAppId}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇" />
                </SelectTrigger>
                <SelectContent>
                  {eligible.length === 0 ? (
                    <SelectItem value="__none__" disabled>
                      所有申請都已 Fork 過此 Master
                    </SelectItem>
                  ) : (
                    eligible.map((a) => (
                      <SelectItem key={a.application_id} value={a.application_id}>
                        {a.school_name}
                        {a.program_name ? ` · ${a.program_name}` : ''}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending || !appId}>
            <GitFork size={14} className="mr-1.5" />
            {pending ? 'Fork 中…' : 'Fork'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
