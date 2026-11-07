export type OfflineItem = { id: string; title: string; savedAt: string } & (
    { kind: 'reading'; passage: string; summary: string } |
    { kind: 'vocabulary'; words: { word: string; meaning: string; example: string }[] }
);

/** Shared catalog content only. Never persist tokens, private API data or chat. */
export async function saveOfflineItem(item: OfflineItem): Promise<void> {
    if (!('indexedDB' in window)) throw new Error('Thiết bị không hỗ trợ lưu nội dung offline.');
    if (JSON.stringify(item).length > 1_000_000) throw new Error('Nội dung quá lớn để tải offline.');
    const db = await new Promise<IDBDatabase>((resolve,reject) => {
        const request = indexedDB.open('englishai-offline-library',1);
        request.onupgradeneeded = () => request.result.createObjectStore('items',{ keyPath: 'id' });
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try { await new Promise<void>((resolve,reject) => {
        const tx = db.transaction('items','readwrite'); const store = tx.objectStore('items');
        const request = store.getAllKeys();
        request.onsuccess = () => { if (request.result.length >= 25 && !request.result.includes(item.id)) tx.abort(); else store.put(item); };
        tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error('Thư viện offline đầy hoặc không ghi được. Hãy mở thư viện và xóa bớt nội dung.'));
    }); } finally { db.close(); }
}

export async function prepareOfflineShell(): Promise<void> {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) throw new Error('Cần HTTPS và trình duyệt hỗ trợ Service Worker để học offline.');
    await navigator.serviceWorker.register('/sw.js');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_,reject) => {
            timeout = setTimeout(() => reject(new Error('Không chuẩn bị được thư viện offline. Hãy kiểm tra mạng và thử lại.')),12_000);
        })]);
    } finally { clearTimeout(timeout); }
}
