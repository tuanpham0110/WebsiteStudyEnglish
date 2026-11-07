import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Alert } from '@/components/ui/feedback';
import { ConfirmDialog } from '@/components/ui/dialog';
import { errorMessage } from '@/lib/api';
import { encodeWav } from '@/lib/audio/pcm';
import { recordPcm, type PcmRecording } from '@/lib/audio/record-pcm';
import { clearRecordings, deleteRecording, listRecordings, saveRecording, type SavedRecording } from '@/lib/audio/recordings';

function Clip({ recording, onDelete }: { recording: SavedRecording; onDelete: () => void }) {
    const [url,setUrl] = useState('');
    useEffect(() => { const value = URL.createObjectURL(recording.audio); setUrl(value); return () => URL.revokeObjectURL(value); },[recording]);
    return <li className="space-y-2 rounded-lg border border-border p-3">
        <p className="text-sm font-medium">{recording.sentence}</p><p className="text-xs text-muted">{new Date(recording.createdAt).toLocaleString('vi-VN')}</p>
        <audio src={url || undefined} controls preload="none" className="w-full" />
        <div className="flex items-center gap-3 text-sm"><a href={url || undefined} download={`englishai-${recording.createdAt.slice(0,10)}-${recording.id.slice(0,8)}.wav`} className="text-primary underline">Tải WAV</a><Button size="sm" variant="ghost" onClick={onDelete}>Xóa bản ghi</Button></div>
    </li>;
}
export function RecordingJournal({ userId, sentence, disabled, onRecordingChange }: { userId: string; sentence: string; disabled: boolean; onRecordingChange: (active: boolean) => void }) {
    const [clips,setClips] = useState<SavedRecording[]>([]);
    const [status,setStatus] = useState<'idle'|'starting'|'recording'>('idle');
    const [error,setError] = useState('');
    const [clearOpen,setClearOpen] = useState(false);
    const capture = useRef<PcmRecording | null>(null);
    const mounted = useRef(false);
    const refresh = async () => setClips(await listRecordings(userId));
    useEffect(() => { mounted.current = true; void listRecordings(userId).then((rows) => { if (mounted.current) setClips(rows); }).catch(() => setError('Không mở được kho ghi âm. Hãy cho phép lưu dữ liệu trên thiết bị.')); return () => { mounted.current = false; capture.current?.abort(); onRecordingChange(false); }; },[userId,onRecordingChange]);
    const record = async () => {
        if (capture.current) return;
        setError(''); setStatus('starting'); onRecordingChange(true);
        const task = recordPcm(() => { if (mounted.current) setStatus('recording'); }); capture.current = task;
        try {
            const pcm = await task.result;
            if (!pcm || !mounted.current) return;
            if (pcm.length < 6400) throw new Error('Bản ghi quá ngắn. Hãy đọc ít nhất một câu.');
            await saveRecording({ id: crypto.randomUUID(), userId, sentence, createdAt: new Date().toISOString(), audio: new Blob([encodeWav(pcm,16000) as Uint8Array<ArrayBuffer>],{ type: 'audio/wav' }) });
            await refresh(); toast.success('Đã lưu giọng nói trên thiết bị này.');
        } catch (err) { if (mounted.current) setError(errorMessage(err)); }
        finally { capture.current = null; if (mounted.current) { setStatus('idle'); onRecordingChange(false); } }
    };
    return <Card><CardHeader title="Nhật ký giọng nói" description="Ghi lại câu đang luyện để so sánh qua các tuần. Chỉ lưu khi bạn nhấn ghi; không gửi âm thanh này lên máy chủ." /><CardBody className="space-y-4">
        <p className="text-sm text-muted">Tối đa 15 giây mỗi bản, 100 bản hoặc 32 MB trên thiết bị này. Dữ liệu có thể mất khi xóa bộ nhớ trình duyệt; hãy tải WAV để giữ lâu dài. Thiết bị dùng chung cần được bảo vệ.</p>
        <div className="flex flex-wrap gap-2">{status === 'idle' ? <Button variant="outline" disabled={disabled || !sentence} onClick={() => void record()}>Ghi và lưu trên thiết bị</Button> : <Button variant="danger" onClick={() => capture.current?.stop()}>{status === 'starting' ? 'Dừng chờ micro' : 'Dừng và lưu bản ghi'}</Button>}{clips.length > 0 && <Button variant="ghost" disabled={status !== 'idle'} onClick={() => setClearOpen(true)}>Xóa kho ghi âm</Button>}</div>
        {error && <Alert tone="warning">{error}</Alert>}
        <ul className="max-h-[32rem] space-y-3 overflow-y-auto">{clips.map((clip) => <Clip key={clip.id} recording={clip} onDelete={() => void deleteRecording(userId,clip.id).then(refresh).catch((err) => setError(errorMessage(err)))} />)}</ul>
        <ConfirmDialog open={clearOpen} onClose={() => setClearOpen(false)} title="Xóa toàn bộ bản ghi trên thiết bị?" danger onConfirm={() => void clearRecordings(userId).then(() => { setClips([]); setClearOpen(false); }).catch((err) => setError(errorMessage(err)))} />
    </CardBody></Card>;
}
