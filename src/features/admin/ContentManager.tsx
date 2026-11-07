import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { EditableLesson } from '@shared/content';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/form';
import { Badge, ErrorState } from '@/components/ui/feedback';
import { db, unwrap } from '@/lib/supabase';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/providers/AuthProvider';
import type { VocabWord } from '@/features/vocabulary/api';
import { WordFormDialog, toWordInput } from '@/features/vocabulary/WordForm';
import { KIND_LABEL, LessonEditor, newLesson } from './LessonEditor';
import { ExerciseEditor } from './ExerciseEditor';

export function ContentManager() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [kind, setKind] = useState<EditableLesson['kind']>('grammar');
    const [editing, setEditing] = useState<EditableLesson | null>(null);
    const [saved, setSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [word, setWord] = useState<Partial<VocabWord> | null>(null);
    const lessons = useQuery({ queryKey: ['admin-content', user?.id, kind], queryFn: async () => unwrap(await db().from('lessons').select('id, kind, level, topic, title, title_vi, summary, content, sort_order, is_published').eq('kind', kind).order('level').order('sort_order').limit(500)) as EditableLesson[] });
    const vocabulary = useQuery({ queryKey: ['admin-catalog', user?.id, search], queryFn: async () => {
        let q = db().from('vocabulary').select('id, owner_id, word, part_of_speech, ipa, meaning_vi, definition_en, example_en, example_vi, level, topic').is('owner_id', null).order('word').limit(50);
        if (search.trim()) q = q.ilike('word', `%${search.trim().replace(/[%_]/g, '')}%`);
        return unwrap(await q) as VocabWord[];
    } });
    return <>
        <Card>
            <CardHeader title="Biên tập bài học" description="Sửa nội dung, câu hỏi và xuất bản trực tiếp. Người học nhận nội dung mới khi tải lại bài." />
            <CardBody className="space-y-3">
                <div className="flex gap-2"><Select aria-label="Loại bài học" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select><Button onClick={() => { setSaved(false); setEditing(newLesson(kind)); }}>Thêm bài học</Button></div>
                {lessons.isError && <ErrorState message={errorMessage(lessons.error)} onRetry={() => void lessons.refetch()} />}
                {lessons.isLoading && <p role="status">Đang tải bài học…</p>}
                <ul className="divide-y divide-border">{lessons.data?.map((l) => <li key={l.id} className="flex items-center justify-between gap-3 py-3"><div><p className="font-medium">{l.title_vi || l.title}</p><span className="text-xs text-muted">{l.level} · {l.title}</span> <Badge tone={l.is_published ? 'success' : 'warning'}>{l.is_published ? 'Đã xuất bản' : 'Bản nháp'}</Badge></div><Button size="sm" variant="outline" onClick={() => { setSaved(true); setEditing(l); }}>Biên tập</Button></li>)}</ul>
            </CardBody>
        </Card>
        <Card>
            <CardHeader title="Từ vựng dùng chung" description="Tìm và chỉnh sửa catalog. Từ vựng riêng của người học không xuất hiện ở đây." />
            <CardBody className="space-y-3">
                <div className="flex gap-2"><Input aria-label="Tìm từ trong catalog" placeholder="Tìm từ…" value={search} onChange={(e) => setSearch(e.target.value)} /><Button onClick={() => setWord({})}>Thêm từ dùng chung</Button></div>
                {vocabulary.isError && <ErrorState message={errorMessage(vocabulary.error)} onRetry={() => void vocabulary.refetch()} />}
                <p className="text-xs text-muted">Hiển thị tối đa 50 từ. Dùng ô tìm kiếm để chọn từ khác.</p>
                <ul className="divide-y divide-border">{vocabulary.data?.map((v) => <li key={v.id} className="flex items-center justify-between gap-3 py-2"><span className="text-sm"><strong>{v.word}</strong> — {v.meaning_vi}</span><Button size="sm" variant="outline" onClick={() => setWord(v)}>Sửa từ</Button></li>)}</ul>
            </CardBody>
        </Card>
        <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} title="Biên tập bài học" className="max-h-[90dvh] max-w-3xl overflow-y-auto">
            {editing && <><LessonEditor key={editing.id} initial={editing} saving={saving} onClose={() => setEditing(null)} onSave={async (value) => {
                setSaving(true);
                try {
                    if (saved) {
                        const { id, ...patch } = value;
                        unwrap(await db().from('lessons').update(patch).eq('id', id).select('id').single());
                    } else unwrap(await db().from('lessons').insert(value as Record<string, unknown>));
                    setEditing(value); setSaved(true); toast.success('Đã lưu bài học.');
                    for (const queryKey of [['admin-content'], ['lessons'], ['lesson', value.id], ['admin-overview']]) void qc.invalidateQueries({ queryKey });
                } finally { setSaving(false); }
            }} />{saved ? <ExerciseEditor key={editing.id} lesson={editing} /> : <p className="mt-4 text-sm text-muted">Lưu bài học trước khi thêm câu hỏi.</p>}</>}
        </Dialog>
        <WordFormDialog open={Boolean(word)} onClose={() => setWord(null)} initial={word ?? undefined} saving={saving} onSubmit={async (values) => {
            setSaving(true);
            try {
                const input = { ...toWordInput(values), topic: word?.topic ?? 'general', example_vi: word?.example_vi ?? null };
                if (word?.id) unwrap(await db().from('vocabulary').update(input).eq('id', word.id).is('owner_id', null).select('id').single());
                else unwrap(await db().from('vocabulary').insert({ ...input, owner_id: null }));
                setWord(null); toast.success('Đã lưu từ vựng dùng chung.');
                for (const queryKey of [['admin-catalog'], ['vocab-catalog'], ['vocab-tracked'], ['admin-overview']]) void qc.invalidateQueries({ queryKey });
            } catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); }
        }} />
    </>;
}
