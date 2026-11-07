import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { exerciseEditSchema, type EditableLesson } from '@shared/content';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import { Alert, ErrorState } from '@/components/ui/feedback';
import { db, unwrap } from '@/lib/supabase';
import { errorMessage } from '@/lib/api';
import type { ExerciseRow } from '@/lib/answers';

const TYPES: Record<ExerciseRow['type'], string> = { multiple_choice: 'Trắc nghiệm', comprehension: 'Đọc/nghe hiểu', placement: 'Xếp lớp', fill_blank: 'Điền từ', error_correction: 'Sửa lỗi', dictation: 'Chính tả', reorder: 'Sắp xếp từ' };
const split = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

export function ExerciseEditor({ lesson }: { lesson: EditableLesson }) {
    const qc = useQueryClient();
    const [editing, setEditing] = useState<ExerciseRow | null>(null);
    const [removing, setRemoving] = useState<ExerciseRow | null>(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const query = useQuery({ queryKey: ['admin-exercises', lesson.id], queryFn: async () => unwrap(await db().from('exercises').select('*').eq('lesson_id', lesson.id).order('sort_order')) as ExerciseRow[] });
    const refresh = () => {
        void qc.invalidateQueries({ queryKey: ['admin-exercises', lesson.id] });
        void qc.invalidateQueries({ queryKey: ['lesson', lesson.id] });
        void qc.invalidateQueries({ queryKey: ['admin-overview'] });
    };
    const save = async () => {
        if (!editing) return;
        const parsed = exerciseEditSchema.safeParse({ ...editing, level: lesson.level });
        if (!parsed.success) return setError(parsed.error.issues.map((i) => i.message).join(' · '));
        setSaving(true); setError('');
        try {
            const exists = query.data?.some((x) => x.id === editing.id);
            if (exists) {
                const { id, lesson_id: _parent, ...patch } = parsed.data;
                unwrap(await db().from('exercises').update(patch).eq('id', id).eq('lesson_id', lesson.id).select('id').single());
            } else unwrap(await db().from('exercises').insert(parsed.data));
            setEditing(null); refresh();
        } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
    };
    const patch = (p: Partial<ExerciseRow>) => setEditing((ex) => ex ? { ...ex, ...p } : ex);
    const choice = editing && ['multiple_choice', 'comprehension', 'placement'].includes(editing.type);
    return <div className="space-y-4 border-t border-border pt-5">
        <h3 className="font-semibold">Câu hỏi của bài học</h3>
        {query.isError && <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />}
        {error && <Alert tone="danger">{error}</Alert>}
        {query.data?.map((ex) => <div key={ex.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
            <span className="min-w-0 truncate text-sm">{ex.sort_order + 1}. {ex.prompt}</span>
            <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => { setEditing(ex); setError(''); }}>Sửa câu hỏi</Button><Button size="sm" variant="ghost" onClick={() => setRemoving(ex)}>Xóa</Button></div>
        </div>)}
        <Button variant="outline" onClick={() => { setError(''); setEditing({ id: `exercise-${crypto.randomUUID()}`, lesson_id: lesson.id, level: lesson.level, type: 'multiple_choice', prompt: '', data: { options: ['', ''] }, answer: { index: 0 }, explanation_vi: '', explanation_en: '', sort_order: query.data?.length ?? 0 }); }}>Thêm câu hỏi</Button>
        {editing && <form className="space-y-3 rounded-xl bg-surface-2 p-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <Field label="Dạng câu hỏi">{(p) => <Select {...p} value={editing.type} onChange={(e) => {
                const type = e.target.value as ExerciseRow['type'];
                patch({ type, data: ['multiple_choice', 'comprehension', 'placement'].includes(type) ? { options: ['', ''] } : type === 'reorder' ? { tokens: [] } : {}, answer: ['multiple_choice', 'comprehension', 'placement'].includes(type) ? { index: 0 } : type === 'reorder' ? { sentence: '' } : { accepted: [] } });
            }}>{Object.entries(TYPES).map(([v, label]) => <option value={v} key={v}>{label}</option>)}</Select>}</Field>
            <Field label="Câu hỏi">{(p) => <Textarea {...p} value={editing.prompt} onChange={(e) => patch({ prompt: e.target.value })} />}</Field>
            {choice ? <>
                <Field label="Các lựa chọn (mỗi dòng một mục)">{(p) => <Textarea {...p} value={editing.data.options?.join('\n') ?? ''} onChange={(e) => patch({ data: { options: e.target.value.split('\n') } })} />}</Field>
                <Field label="Số thứ tự đáp án đúng (bắt đầu từ 1)">{(p) => <Input {...p} type="number" min={1} value={(editing.answer.index ?? 0) + 1} onChange={(e) => patch({ answer: { index: Number(e.target.value) - 1 } })} />}</Field>
            </> : editing.type === 'reorder' ? <>
                <Field label="Các từ để sắp xếp (mỗi dòng một từ)">{(p) => <Textarea {...p} value={editing.data.tokens?.join('\n') ?? ''} onChange={(e) => patch({ data: { tokens: e.target.value.split('\n') } })} />}</Field>
                <Field label="Câu đáp án">{(p) => <Input {...p} value={editing.answer.sentence ?? ''} onChange={(e) => patch({ answer: { sentence: e.target.value } })} />}</Field>
            </> : <Field label="Đáp án được chấp nhận (mỗi dòng một cách trả lời)">{(p) => <Textarea {...p} value={editing.answer.accepted?.join('\n') ?? ''} onChange={(e) => patch({ answer: { accepted: e.target.value.split('\n') } })} onBlur={() => patch({ answer: { accepted: split(editing.answer.accepted?.join('\n') ?? '') } })} />}</Field>}
            <Field label="Giải thích tiếng Việt">{(p) => <Textarea {...p} value={editing.explanation_vi ?? ''} onChange={(e) => patch({ explanation_vi: e.target.value })} />}</Field>
            <Field label="Giải thích tiếng Anh">{(p) => <Textarea {...p} value={editing.explanation_en ?? ''} onChange={(e) => patch({ explanation_en: e.target.value })} />}</Field>
            <Field label="Thứ tự">{(p) => <Input {...p} type="number" value={editing.sort_order} onChange={(e) => patch({ sort_order: Number(e.target.value) })} />}</Field>
            <div className="flex gap-2"><Button type="submit" loading={saving}>Lưu câu hỏi</Button><Button variant="ghost" onClick={() => setEditing(null)}>Hủy</Button></div>
        </form>}
        <ConfirmDialog open={Boolean(removing)} onClose={() => setRemoving(null)} title="Xóa câu hỏi này?" description="Kết quả làm bài trước đây vẫn được giữ lại." danger loading={saving} onConfirm={() => {
            if (!removing) return;
            setSaving(true);
            void (async () => { try { unwrap(await db().from('exercises').delete().eq('id', removing.id).select('id').single()); setRemoving(null); refresh(); } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); } })();
        }} />
    </div>;
}
