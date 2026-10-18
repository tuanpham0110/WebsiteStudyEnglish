import { useState } from 'react';
import { Check, MessageSquarePlus, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/form';
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/feedback';
import { cn } from '@/lib/cn';
import { errorMessage } from '@/lib/api';
import { formatRelative } from '@/lib/format';
import { useConversationMutations, type ConversationRow } from './api';

export function ConversationList({
  query,
  activeId,
  onSelect,
  onNew,
  onDeleted,
}: {
  query: { data?: ConversationRow[]; isLoading: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDeleted: (id: string) => void;
}) {
  const { rename, remove } = useConversationMutations();
  const [editing, setEditing] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [deleting, setDeleting] = useState<ConversationRow | null>(null);

  const saveTitle = async (id: string) => {
    try {
      await rename.mutateAsync({ id, title });
      setEditing(null);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Button onClick={onNew} className="mb-3 w-full">
        <MessageSquarePlus className="h-4 w-4" aria-hidden /> Hội thoại mới
      </Button>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {query.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : !query.data?.length ? (
          <EmptyState title="Chưa có hội thoại" description="Gửi tin nhắn đầu tiên để bắt đầu." className="py-8" />
        ) : (
          <ul className="space-y-1">
            {query.data.map((c) => (
              <li key={c.id}>
                {editing === c.id ? (
                  <form
                    className="flex items-center gap-1 p-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void saveTitle(c.id);
                    }}
                  >
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} autoFocus aria-label="Tên hội thoại" className="h-8" />
                    <Button type="submit" size="icon-sm" variant="ghost" aria-label="Lưu tên">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label="Hủy" onClick={() => setEditing(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </form>
                ) : (
                  <div
                    className={cn(
                      'group flex items-center gap-1 rounded-lg pr-1 transition-colors',
                      activeId === c.id ? 'bg-primary-soft' : 'hover:bg-surface-2',
                    )}
                  >
                    <button type="button" onClick={() => onSelect(c.id)} className="min-w-0 flex-1 px-3 py-2 text-left" aria-current={activeId === c.id ? 'true' : undefined}>
                      <p className={cn('truncate text-sm font-medium', activeId === c.id && 'text-primary')}>{c.title}</p>
                      <p className="text-xs text-muted">
                        {c.level} · {formatRelative(c.last_message_at)}
                      </p>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Đổi tên “${c.title}”`}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      onClick={() => {
                        setEditing(c.id);
                        setTitle(c.title);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Xóa “${c.title}”`}
                      className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                      onClick={() => setDeleting(c)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Xóa hội thoại?"
        description={`“${deleting?.title}” và toàn bộ tin nhắn sẽ bị xóa vĩnh viễn.`}
        confirmLabel="Xóa"
        danger
        loading={remove.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove.mutateAsync(deleting.id);
            onDeleted(deleting.id);
            setDeleting(null);
            toast.success('Đã xóa hội thoại.');
          } catch (error) {
            toast.error(errorMessage(error));
          }
        }}
      />
    </div>
  );
}
