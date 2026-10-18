import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { LEVELS } from '@shared/constants';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/form';
import type { VocabWord } from './api';

const schema = z.object({
  word: z.string().trim().min(1, 'Nhập từ.').max(80),
  part_of_speech: z.string().trim().max(30).optional(),
  ipa: z.string().trim().max(80).optional(),
  meaning_vi: z.string().trim().min(1, 'Nhập nghĩa tiếng Việt.').max(300),
  definition_en: z.string().trim().max(500).optional(),
  example_en: z.string().trim().max(500).optional(),
  level: z.enum(['', ...LEVELS]).optional(),
});
export type WordFormValues = z.infer<typeof schema>;

export function toWordInput(v: WordFormValues): Omit<VocabWord, 'id' | 'owner_id'> {
  return {
    word: v.word,
    part_of_speech: v.part_of_speech || null,
    ipa: v.ipa || null,
    meaning_vi: v.meaning_vi,
    definition_en: v.definition_en || null,
    example_en: v.example_en || null,
    example_vi: null,
    level: (v.level || null) as VocabWord['level'],
    topic: 'personal',
  };
}

export function WordFormDialog({
  open,
  onClose,
  initial,
  onSubmit,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Partial<VocabWord>;
  onSubmit: (values: WordFormValues) => Promise<void>;
  saving: boolean;
}) {
  const { register, handleSubmit, formState, reset } = useForm<WordFormValues>({
    resolver: zodResolver(schema),
    values: {
      word: initial?.word ?? '',
      part_of_speech: initial?.part_of_speech ?? '',
      ipa: initial?.ipa ?? '',
      meaning_vi: initial?.meaning_vi ?? '',
      definition_en: initial?.definition_en ?? '',
      example_en: initial?.example_en ?? '',
      level: (initial?.level ?? '') as WordFormValues['level'],
    },
  });
  return (
    <Dialog
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title={initial?.id ? 'Sửa từ' : 'Thêm từ của bạn'}
    >
      <form
        className="space-y-3"
        onSubmit={handleSubmit(async (v) => {
          await onSubmit(v);
          reset();
        })}
        noValidate
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Từ / cụm từ" error={formState.errors.word?.message}>
            {(p) => <Input {...p} {...register('word')} />}
          </Field>
          <Field label="Từ loại" hint="noun, verb, adjective…">
            {(p) => <Input {...p} {...register('part_of_speech')} />}
          </Field>
          <Field label="Phiên âm IPA (nếu có)">{(p) => <Input {...p} placeholder="/ˈeksəmpəl/" {...register('ipa')} />}</Field>
          <Field label="Trình độ">
            {(p) => (
              <Select {...p} {...register('level')}>
                <option value="">Không rõ</option>
                {LEVELS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Nghĩa tiếng Việt" error={formState.errors.meaning_vi?.message}>
          {(p) => <Input {...p} {...register('meaning_vi')} />}
        </Field>
        <Field label="Định nghĩa tiếng Anh">{(p) => <Input {...p} {...register('definition_en')} />}</Field>
        <Field label="Ví dụ">{(p) => <Textarea {...p} rows={2} className="min-h-0" {...register('example_en')} />}</Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={saving}>
            Lưu
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
