'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DEGREE_LEVEL_LABELS, DEGREE_LEVEL_VALUES } from '@/lib/constants/school'
import { schoolProgramSchema, type SchoolProgramInput } from '@/lib/validators/school'

import { createSchoolProgram, updateSchoolProgram } from '@/app/(dashboard)/schools/actions'

type Props = {
  mode: 'create' | 'edit'
  schoolId: string
  initial?: Partial<SchoolProgramInput> & { id?: string }
  trigger: React.ReactNode
}

export function ProgramFormDialog({ mode, schoolId, initial, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const form = useForm<SchoolProgramInput>({
    resolver: zodResolver(schoolProgramSchema),
    defaultValues: {
      school_id: schoolId,
      program_name: initial?.program_name ?? '',
      degree_level: initial?.degree_level ?? 'master',
      major_category: initial?.major_category ?? null,
      application_deadline_round1: initial?.application_deadline_round1 ?? null,
      application_deadline_round2: initial?.application_deadline_round2 ?? null,
      notes: initial?.notes ?? null,
    },
  })

  const handleSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      const result =
        mode === 'create'
          ? await createSchoolProgram(data)
          : await updateSchoolProgram(initial?.id ?? '', data)
      if (!result.ok) {
        toast.error(result.error)
        if (result.fieldErrors) {
          for (const [path, messages] of Object.entries(result.fieldErrors)) {
            form.setError(path as keyof SchoolProgramInput, {
              type: 'server',
              message: messages.join(', '),
            })
          }
        }
        return
      }
      toast.success(mode === 'create' ? '已新增科系' : '已更新科系')
      setOpen(false)
      router.refresh()
    })
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next && mode === 'create') form.reset()
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? '新增科系' : '編輯科系'}</DialogTitle>
          <DialogDescription>列出本校開設的學位/科系,供顧問加入學生選校表。</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="program_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    科系名稱 <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例:MS in Computer Science"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="degree_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>學位</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DEGREE_LEVEL_VALUES.map((v) => (
                          <SelectItem key={v} value={v}>
                            {DEGREE_LEVEL_LABELS[v]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="major_category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>類別</FormLabel>
                    <FormControl>
                      <Input placeholder="例:CS / EE / MBA" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="application_deadline_round1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Round 1 截止</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="application_deadline_round2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Round 2 截止</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備註</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                取消
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? '儲存中…' : mode === 'create' ? '新增' : '儲存'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
