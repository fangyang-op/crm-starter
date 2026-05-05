'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'

import { softDeleteStudent } from '@/app/(dashboard)/students/actions'

export function DeleteStudentDialog({ studentId }: { studentId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleDelete = () => {
    startTransition(async () => {
      const result = await softDeleteStudent(studentId)
      if (!result.ok) {
        toast.error(result.error)
      } else {
        toast.success('已刪除學生(可恢復)')
        router.push('/students')
        router.refresh()
      }
    })
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Trash2 size={14} className="mr-1.5" />
          刪除
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>確定要刪除這位學生?</AlertDialogTitle>
          <AlertDialogDescription>
            此操作為軟刪除,學生資料會被標記為刪除但保留在資料庫中。需復原請聯繫 admin。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>取消</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={pending}>
            {pending ? '刪除中…' : '確認刪除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
