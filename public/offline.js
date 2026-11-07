// This database contains only explicitly downloaded shared lessons/catalog words.
const library = document.getElementById('library');
const reader = document.getElementById('reader');
const status = document.getElementById('status');
function element(tag,text,className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
function button(text,action) { const node = element('button',text); node.type = 'button'; node.addEventListener('click',action); return node; }
async function store(mode,action) {
    const db = await new Promise((resolve,reject) => { const r = indexedDB.open('englishai-offline-library',1); r.onupgradeneeded = () => r.result.createObjectStore('items',{ keyPath: 'id' }); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try { return await new Promise((resolve,reject) => { const tx = db.transaction('items',mode); const r = action(tx.objectStore('items')); tx.oncomplete = () => resolve(r.result); tx.onerror = () => reject(tx.error); }); } finally { db.close(); }
}
function show(item) {
    library.hidden = true; reader.hidden = false; reader.replaceChildren();
    reader.append(button('← Về thư viện',() => { reader.hidden = true; library.hidden = false; }));
    const card = element('article'); card.append(element('h2',item.title)); reader.append(card);
    if (item.kind === 'reading') { card.append(element('p',item.passage,'passage'),element('p',item.summary,'note')); return; }
    const words = item.words || []; if (!words.length) { card.append(element('p','Bộ thẻ trống.')); return; }
    let i = 0; const face = element('div'); const count = element('p',undefined,'note');
    const reveal = button('Hiện nghĩa',() => { face.append(element('p',words[i].meaning,'meaning'),element('p',words[i].example)); reveal.disabled = true; });
    const draw = () => { face.replaceChildren(element('p',words[i].word,'word')); count.textContent = `Thẻ ${i+1}/${words.length}`; reveal.disabled = false; };
    const actions = element('div',undefined,'actions'); actions.append(reveal,button('Thẻ trước',() => { i = (i+words.length-1)%words.length; draw(); }),button('Thẻ tiếp',() => { i = (i+1)%words.length; draw(); }));
    card.append(count,face,actions); draw();
}
async function load() {
    try {
        const items = await store('readonly',(s) => s.getAll()); items.sort((a,b) => b.savedAt.localeCompare(a.savedAt));
        library.replaceChildren(); status.textContent = items.length ? `${items.length}/25 mục đã tải. Xóa dữ liệu trình duyệt sẽ xóa thư viện này.` : 'Chưa có nội dung. Khi có mạng, mở một bài đọc hoặc catalog từ vựng rồi chọn “Tải để học offline”.';
        for (const item of items) { const card = element('article'); card.append(element('h2',item.title),element('p',`${item.kind === 'reading' ? 'Bài đọc' : 'Thẻ từ'} · ${new Date(item.savedAt).toLocaleDateString('vi-VN')}`,'note')); const actions = element('div',undefined,'actions'); actions.append(button('Mở để học',() => show(item)),button('Xóa khỏi thiết bị',async () => { if (!confirm(`Xóa “${item.title}” khỏi thư viện offline?`)) return; try { await store('readwrite',(s) => s.delete(item.id)); await load(); } catch { status.textContent = 'Không xóa được nội dung. Hãy thử lại.'; } })); card.append(actions); library.append(card); }
    } catch { status.textContent = 'Không mở được thư viện. Hãy cho phép trang lưu dữ liệu trên thiết bị.'; }
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
void load();
