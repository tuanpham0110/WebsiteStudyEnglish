import { useState } from 'react';
import { LEVELS } from '@shared/constants';
import { lessonEditSchema, type EditableLesson } from '@shared/content';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Switch, Textarea } from '@/components/ui/form';
import { Alert } from '@/components/ui/feedback';

export const KIND_LABEL = { grammar: 'Ngữ pháp', reading: 'Đọc', listening: 'Nghe', pronunciation: 'Phát âm' };
export function newLesson(kind: EditableLesson['kind']): EditableLesson {
    const contents = { grammar: { explanationVi: '', explanationEn: '', structure: [], examples: [], tips: [] }, reading: { passage: '', summaryVi: '', wordCount: 0 }, listening: { script: [{ speaker: 'A', text: '' }], summaryVi: '', dictation: [] }, pronunciation: { tipsVi: '', sentences: [{ text: '' }] } };
    return { id: `lesson-${crypto.randomUUID()}`, kind, title: '', title_vi: '', level: 'A1', topic: 'general', summary: '', sort_order: 0, is_published: false, content: contents[kind] } as EditableLesson;
}
const lines = (v: string) => v.split('\n').map((s) => s.trim()).filter(Boolean);

export function LessonEditor({ initial, saving, onSave, onClose }: { initial: EditableLesson; saving: boolean; onSave: (lesson: EditableLesson) => Promise<void>; onClose: () => void }) {
    const [lesson, setLesson] = useState(initial);
    const [error, setError] = useState('');
    const set = (patch: Partial<EditableLesson>) => setLesson((old) => ({ ...old, ...patch }) as EditableLesson);
    const field = (label: string, value: string, change: (v: string) => void, multiline = false, hint?: string) => <Field label={label} hint={hint}>{(p) => multiline ? <Textarea {...p} value={value} onChange={(e) => change(e.target.value)} /> : <Input {...p} value={value} onChange={(e) => change(e.target.value)} />}</Field>;
    return <form className="space-y-4" onSubmit={(e) => {
        e.preventDefault();
        let candidate = lesson;
        if (lesson.kind === 'grammar') candidate = { ...lesson, content: { ...lesson.content, structure: lines(lesson.content.structure.join('\n')), tips: lines(lesson.content.tips.join('\n')) } };
        if (lesson.kind === 'listening') candidate = { ...lesson, content: { ...lesson.content, dictation: lines(lesson.content.dictation.join('\n')) } };
        const parsed = lessonEditSchema.safeParse(candidate);
        if (!parsed.success) return setError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).slice(0,3).join(' · '));
        setError(''); void onSave(parsed.data).catch((err: Error) => setError(err.message));
    }}>
        <p className="text-sm text-muted">{KIND_LABEL[lesson.kind]} · {lesson.id}</p>
        {field('Tiêu đề tiếng Anh', lesson.title, (title) => set({ title }))}
        {field('Tiêu đề tiếng Việt', lesson.title_vi ?? '', (title_vi) => set({ title_vi }))}
        <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Trình độ">{(p) => <Select {...p} value={lesson.level} onChange={(e) => set({ level: e.target.value as EditableLesson['level'] })}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</Select>}</Field>
            {field('Chủ đề', lesson.topic, (topic) => set({ topic }))}
            <Field label="Thứ tự">{(p) => <Input {...p} type="number" value={lesson.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} />}</Field>
        </div>
        {field('Giới thiệu ngắn', lesson.summary ?? '', (summary) => set({ summary }), true)}
        {lesson.kind === 'reading' && (() => { const c = lesson.content; return <>
            {field('Bài đọc', c.passage, (passage) => set({ content: { ...c, passage, wordCount: passage.trim().split(/\s+/).filter(Boolean).length } }), true)}
            {field('Tóm tắt tiếng Việt', c.summaryVi, (summaryVi) => set({ content: { ...c, summaryVi } }), true)}
        </>; })()}
        {lesson.kind === 'grammar' && (() => {
            const c = lesson.content; const content = (patch: Partial<typeof c>) => set({ content: { ...c, ...patch } });
            return <>
                {field('Giải thích tiếng Việt', c.explanationVi, (explanationVi) => content({ explanationVi }), true)}
                {field('Giải thích tiếng Anh', c.explanationEn, (explanationEn) => content({ explanationEn }), true)}
                {field('Cấu trúc (mỗi dòng một mục)', c.structure.join('\n'), (v) => content({ structure: v.split('\n') }), true)}
                {field('Mẹo (mỗi dòng một mục)', c.tips.join('\n'), (v) => content({ tips: v.split('\n') }), true)}
                {c.examples.map((ex,i) => { const update = (patch: Partial<typeof ex>) => content({ examples: c.examples.map((x,j) => i === j ? { ...x,...patch } : x) }); return <div className="space-y-2 rounded-lg border border-border p-3" key={i}>
                    {field(`Ví dụ ${i+1}`, ex.en, (en) => update({ en }))}{field('Bản dịch', ex.vi ?? '', (vi) => update({ vi }))}
                    <Switch label="Câu ví dụ đúng" checked={ex.correct} onChange={(correct) => update({ correct })} />
                    {!ex.correct && field('Câu sửa đúng', ex.fix ?? '', (fix) => update({ fix }))}
                    {field('Ghi chú', ex.note ?? '', (note) => update({ note }))}
                    <Button size="sm" variant="ghost" onClick={() => content({ examples: c.examples.filter((_,j) => j !== i) })}>Bỏ ví dụ</Button>
                </div>; })}
                <Button variant="outline" onClick={() => content({ examples: [...c.examples,{ en: '', correct: true }] })}>Thêm ví dụ</Button>
            </>;
        })()}
        {lesson.kind === 'pronunciation' && (() => { const c = lesson.content; return <>
            {field('Hướng dẫn phát âm', c.tipsVi, (tipsVi) => set({ content: { ...c,tipsVi } }), true)}
            {field('Câu luyện tập (mỗi dòng một câu)', c.sentences.map((s) => s.text).join('\n'), (v) => set({ content: { ...c,sentences: v.split('\n').map((text) => ({ text })) } }), true)}
        </>; })()}
        {lesson.kind === 'listening' && (() => { const c = lesson.content; const content = (patch: Partial<typeof c>) => set({ content: { ...c,...patch } }); return <>
            {field('Tóm tắt tiếng Việt', c.summaryVi, (summaryVi) => content({ summaryVi }), true)}
            {c.script.map((line,i) => { const update = (patch: Partial<typeof line>) => content({ script: c.script.map((s,j) => i === j ? { ...s,...patch } : s) }); return <div key={i} className="space-y-2 rounded-lg border border-border p-3">
                {field(`Người nói — câu ${i+1}`, line.speaker, (speaker) => update({ speaker }))}
                {field('Lời thoại', line.text, (text) => update({ text }), true)}
                {field('Đường dẫn bản thu âm', line.audioUrl ?? '', (audioUrl) => update({ audioUrl }), false, 'MP3/WAV/OGG từ /audio/... hoặc HTTPS. Để trống để dùng giọng máy. Chỉ dùng audio có quyền sử dụng.')}
                <Button size="sm" variant="ghost" disabled={c.script.length === 1} onClick={() => content({ script: c.script.filter((_,j) => j !== i) })}>Bỏ câu</Button>
            </div>; })}
            <Button variant="outline" onClick={() => content({ script: [...c.script,{ speaker: 'A',text: '' }] })}>Thêm câu thoại</Button>
            {field('Câu nghe chính tả (mỗi dòng một câu)', c.dictation.join('\n'), (v) => content({ dictation: v.split('\n') }), true)}
        </>; })()}
        <Switch label="Xuất bản cho người học" checked={lesson.is_published} onChange={(is_published) => set({ is_published })} description="Tắt để giữ bản nháp hoặc tạm ẩn bài học." />
        {error && <Alert tone="danger">{error}</Alert>}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={onClose}>Đóng</Button><Button type="submit" loading={saving}>Lưu bài học</Button></div>
    </form>;
}
