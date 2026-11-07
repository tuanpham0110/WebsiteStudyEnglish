export type SavedRecording = { id: string; userId: string; sentence: string; createdAt: string; audio: Blob };
const NAME = 'englishai-recordings';
const STORE = 'clips';
function open(): Promise<IDBDatabase> {
    return new Promise((resolve,reject) => {
        const request = indexedDB.open(NAME,1);
        request.onupgradeneeded = () => request.result.createObjectStore(STORE,{ keyPath: 'id' }).createIndex('userId','userId');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await open();
    try {
        return await new Promise<T>((resolve,reject) => {
            const tx = db.transaction(STORE,mode);
            const request = action(tx.objectStore(STORE));
            tx.oncomplete = () => resolve(request.result);
            tx.onabort = () => reject(tx.error ?? new Error('Không lưu được bản ghi.'));
            tx.onerror = () => reject(tx.error);
        });
    } finally { db.close(); }
}
export async function listRecordings(userId: string): Promise<SavedRecording[]> {
    const rows = await transaction('readonly',(store) => store.index('userId').getAll(userId)) as SavedRecording[];
    return rows.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
}
export async function saveRecording(recording: SavedRecording): Promise<void> {
    // Serialize the limit check and write across tabs in the same transaction.
    const db = await open();
    try {
        await new Promise<void>((resolve,reject) => {
            const tx = db.transaction(STORE,'readwrite'); const store = tx.objectStore(STORE);
            const request = store.index('userId').getAll(recording.userId);
            request.onsuccess = () => {
                const rows = request.result as SavedRecording[];
                if (rows.length >= 100 || rows.reduce((n,r) => n+r.audio.size,0)+recording.audio.size > 32*1024*1024) { tx.abort(); return; }
                store.add(recording);
            };
            tx.oncomplete = () => resolve();
            tx.onabort = () => reject(new Error('Kho ghi âm đầy hoặc không ghi được. Hãy tải xuống và xóa bớt bản ghi.'));
            tx.onerror = () => reject(tx.error);
        });
    } finally { db.close(); }
}
export async function deleteRecording(userId: string, id: string): Promise<void> {
    const rows = await listRecordings(userId);
    if (rows.some((r) => r.id === id)) await transaction('readwrite',(store) => store.delete(id));
}
export async function clearRecordings(userId: string): Promise<void> {
    const rows = await listRecordings(userId);
    const db = await open();
    try { await new Promise<void>((resolve,reject) => {
        const tx = db.transaction(STORE,'readwrite'); const store = tx.objectStore(STORE);
        rows.forEach((row) => store.delete(row.id));
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    }); } finally { db.close(); }
}
