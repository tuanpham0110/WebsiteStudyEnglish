import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { prepareOfflineShell, saveOfflineItem, type OfflineItem } from '@/lib/offline';
import { errorMessage } from '@/lib/api';

type Unstamped<T> = T extends unknown ? Omit<T,'savedAt'> : never;
export function SaveOfflineButton({ item }: { item: Unstamped<OfflineItem> }) {
    const [saving,setSaving] = useState(false);
    return <div className="flex flex-wrap items-center gap-3 text-sm"><Button variant="outline" loading={saving} onClick={() => {
        setSaving(true);
        void (async () => { try {
            await prepareOfflineShell();
            await saveOfflineItem({ ...item,savedAt: new Date().toISOString() } as OfflineItem);
            toast.success('Đã tải vào thư viện offline trên thiết bị này.');
        } catch (err) { toast.error(errorMessage(err)); } finally { setSaving(false); } })();
    }}>Tải để học offline</Button><a href="/offline.html" className="text-primary underline">Mở thư viện offline</a></div>;
}
