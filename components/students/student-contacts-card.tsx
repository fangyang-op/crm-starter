'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Mail, Pencil, Phone, Plus, Star, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

import {
  addStudentContact,
  deleteStudentContact,
  updateStudentContact,
  type ContactRelation,
} from '@/app/(dashboard)/students/[id]/contacts/actions'

export type StudentContactRow = {
  id: string
  relation: string
  name: string
  phone: string | null
  email: string | null
  line_id: string | null
  is_primary_contact: boolean
  notes: string | null
}

const RELATIONS: ContactRelation[] = ['父親', '母親', '監護人', '親戚', '其他']

type Props = {
  studentId: string
  contacts: StudentContactRow[]
  canEdit: boolean
}

export function StudentContactsCard({ studentId, contacts, canEdit }: Props) {
  const [editing, setEditing] = useState<StudentContactRow | null>(null)
  const [creating, setCreating] = useState(false)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base">關係人</CardTitle>
        {canEdit ? (
          <Button variant="ghost" size="sm" onClick={() => setCreating(true)}>
            <Plus size={14} className="mr-1" />
            新增
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {contacts.length === 0 ? (
          <p className="text-xs text-muted-foreground">尚未填寫關係人。</p>
        ) : (
          contacts.map((c) => (
            <ContactRow
              key={c.id}
              studentId={studentId}
              contact={c}
              canEdit={canEdit}
              onEdit={() => setEditing(c)}
            />
          ))
        )}
      </CardContent>

      {creating ? (
        <ContactDialog
          studentId={studentId}
          contact={null}
          existingPrimary={contacts.some((c) => c.is_primary_contact)}
          onClose={() => setCreating(false)}
        />
      ) : null}
      {editing ? (
        <ContactDialog
          studentId={studentId}
          contact={editing}
          existingPrimary={contacts.some((c) => c.is_primary_contact && c.id !== editing.id)}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </Card>
  )
}

function ContactRow({
  studentId,
  contact,
  canEdit,
  onEdit,
}: {
  studentId: string
  contact: StudentContactRow
  canEdit: boolean
  onEdit: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleDelete = () => {
    if (!window.confirm(`確定移除「${contact.name}」?`)) return
    startTransition(async () => {
      const r = await deleteStudentContact(contact.id, studentId)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success('已移除')
      router.refresh()
    })
  }

  return (
    <div className="rounded-md border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{contact.name}</span>
            <Badge variant="outline">{contact.relation}</Badge>
            {contact.is_primary_contact ? (
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                <Star size={10} className="mr-0.5" />
                主要聯絡人
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {contact.phone ? (
              <span className="inline-flex items-center gap-1">
                <Phone size={11} />
                {contact.phone}
              </span>
            ) : null}
            {contact.email ? (
              <span className="inline-flex items-center gap-1">
                <Mail size={11} />
                {contact.email}
              </span>
            ) : null}
            {contact.line_id ? <span>LINE: {contact.line_id}</span> : null}
          </div>
          {contact.notes ? <p className="text-xs text-muted-foreground">{contact.notes}</p> : null}
        </div>
        {canEdit ? (
          <div className="flex shrink-0 gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onEdit}
              disabled={pending}
              aria-label="編輯"
            >
              <Pencil size={13} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={pending}
              aria-label="刪除"
            >
              <Trash2 size={13} />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function ContactDialog({
  studentId,
  contact,
  existingPrimary,
  onClose,
}: {
  studentId: string
  contact: StudentContactRow | null
  /** True when *another* contact is already primary — we surface a hint that
   *  saving as primary will not auto-demote the other one (we don't enforce
   *  uniqueness). */
  existingPrimary: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [relation, setRelation] = useState<ContactRelation>(
    (contact?.relation as ContactRelation | undefined) ?? '母親',
  )
  const [name, setName] = useState(contact?.name ?? '')
  const [phone, setPhone] = useState(contact?.phone ?? '')
  const [email, setEmail] = useState(contact?.email ?? '')
  const [lineId, setLineId] = useState(contact?.line_id ?? '')
  const [isPrimary, setIsPrimary] = useState(contact?.is_primary_contact ?? false)
  const [notes, setNotes] = useState(contact?.notes ?? '')

  const submit = () => {
    if (!name.trim()) {
      toast.error('請填寫姓名')
      return
    }
    startTransition(async () => {
      const payload = {
        relation,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
        line_id: lineId.trim() || null,
        is_primary_contact: isPrimary,
        notes: notes.trim() || null,
      }
      const r = contact
        ? await updateStudentContact(contact.id, studentId, payload)
        : await addStudentContact(studentId, payload)
      if (!r.ok) {
        toast.error(r.error)
        return
      }
      toast.success(contact ? '已更新' : '已新增')
      onClose()
      router.refresh()
    })
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{contact ? '編輯關係人' : '新增關係人'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cd-relation">
                與學生關係 <span className="text-destructive">*</span>
              </Label>
              <Select value={relation} onValueChange={(v) => setRelation(v as ContactRelation)}>
                <SelectTrigger id="cd-relation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELATIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-name">
                姓名 <span className="text-destructive">*</span>
              </Label>
              <Input id="cd-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-phone">手機</Label>
              <Input id="cd-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-email">Email</Label>
              <Input id="cd-email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cd-line">LINE ID</Label>
              <Input id="cd-line" value={lineId} onChange={(e) => setLineId(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={isPrimary} onCheckedChange={(v) => setIsPrimary(v === true)} />
            設為主要聯絡人
          </label>
          {isPrimary && existingPrimary ? (
            <p className="text-xs text-muted-foreground">
              ⚠
              目前已有另一位主要聯絡人,儲存後兩位都會被標記。如需切換,請先把另一位的「主要聯絡人」取消勾選。
            </p>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="cd-notes">備註</Label>
            <Textarea
              id="cd-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            取消
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? '儲存中…' : '儲存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
