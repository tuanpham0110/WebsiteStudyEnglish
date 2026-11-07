import { z } from 'zod';
import { LEVELS } from './constants';
const text = (max: number) => z.string().trim().min(1).max(max);
export const audioUrlSchema = z.string().max(2000).refine((v) => {
    if (!v) return true;
    if (v.startsWith('/') && !v.startsWith('//') && !v.includes('\\')) return true;
    try { return new URL(v).protocol === 'https:'; } catch { return false; }
}, 'Dùng đường dẫn /audio/... hoặc URL HTTPS.');
export const grammarContentSchema = z.object({
    explanationVi: text(20_000), explanationEn: z.string().max(20_000), structure: z.array(text(1000)).max(50), tips: z.array(text(2000)).max(50),
    examples: z.array(z.object({ en: text(2000), vi: z.string().max(2000).optional(), correct: z.boolean(), fix: z.string().max(2000).optional(), note: z.string().max(2000).optional() })).max(100),
});
export const readingContentSchema = z.object({ passage: text(50_000), summaryVi: z.string().max(5000), wordCount: z.number().int().nonnegative() });
export const listeningContentSchema = z.object({ script: z.array(z.object({ speaker: text(80), text: text(2000), audioUrl: audioUrlSchema.optional() })).min(1).max(100), summaryVi: z.string().max(5000), dictation: z.array(text(2000)).max(50) });
export const pronunciationContentSchema = z.object({ tipsVi: z.string().max(10_000), sentences: z.array(z.object({ text: text(500) })).min(1).max(100) });
const base = { id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/), level: z.enum(LEVELS), topic: text(60), title: text(160), title_vi: z.string().max(160).nullable(), summary: z.string().max(500).nullable(), sort_order: z.number().int(), is_published: z.boolean() };
export const lessonEditSchema = z.discriminatedUnion('kind', [
    z.object({ ...base, kind: z.literal('grammar'), content: grammarContentSchema }), z.object({ ...base, kind: z.literal('reading'), content: readingContentSchema }),
    z.object({ ...base, kind: z.literal('listening'), content: listeningContentSchema }), z.object({ ...base, kind: z.literal('pronunciation'), content: pronunciationContentSchema }),
]);
export type EditableLesson = z.infer<typeof lessonEditSchema>;
export const exerciseEditSchema = z.object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{1,99}$/), lesson_id: z.string(), type: z.enum(['multiple_choice','comprehension','placement','fill_blank','error_correction','dictation','reorder']), level: z.enum(LEVELS), prompt: text(2000), sort_order: z.number().int(),
    data: z.object({ options: z.array(text(1000)).max(10).optional(), tokens: z.array(text(300)).max(100).optional() }), answer: z.object({ index: z.number().int().nonnegative().optional(), accepted: z.array(text(2000)).max(30).optional(), sentence: text(2000).optional() }), explanation_vi: z.string().max(2000).nullable(), explanation_en: z.string().max(2000).nullable(),
}).superRefine((ex, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (['multiple_choice','comprehension','placement'].includes(ex.type)) {
        if (!ex.data.options || ex.data.options.length < 2 || ex.answer.index === undefined || ex.answer.index >= ex.data.options.length) fail('Cần ít nhất 2 lựa chọn và số đáp án đúng hợp lệ.');
    } else if (ex.type === 'reorder') {
        const words = (v: string) => v.toLowerCase().trim().split(/\s+/).sort().join(' ');
        if (!ex.data.tokens?.length || !ex.answer.sentence || words(ex.data.tokens.join(' ')) !== words(ex.answer.sentence)) fail('Các từ cần khớp câu đáp án, kể cả dấu câu.');
    } else if (!ex.answer.accepted?.length) fail('Nhập ít nhất một đáp án được chấp nhận.');
});
