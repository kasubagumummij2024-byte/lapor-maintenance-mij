// public/utils.js (Final dengan Perbaikan Render HTML)
const utils = {
    showLoading: (container) => { container.innerHTML = '<div class="p-8 text-center text-gray-400">⏳ Memuat data...</div>'; },
    showError: (container, err) => { console.error('Error:', err); const message = (err && err.message) ? err.message : 'Terjadi kesalahan server.'; container.innerHTML = `<div class="p-8 text-center text-red-400">❌ Gagal memuat: ${utils.escapeHtml(message)}</div>`; },
    escapeHtml: (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c)),
    showModal: ({ title, body, onConfirm, confirmText = 'OK', cancelText = 'Batal' }) => {
        const modal = document.getElementById('appModal'); if (!modal) return;
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalBody').innerHTML = body;
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');
        confirmBtn.textContent = confirmText; cancelBtn.textContent = cancelText;
        const confirmHandler = () => { if (onConfirm) onConfirm(); utils.hideModal(); };
        const cancelHandler = () => utils.hideModal();
        confirmBtn.onclick = confirmHandler; cancelBtn.onclick = cancelHandler;
        modal.classList.add('is-visible');
    },
    hideModal: () => {
        const modal = document.getElementById('appModal'); if (!modal) return;
        modal.classList.remove('is-visible');
        const confirmBtn = document.getElementById('modalConfirmBtn'); confirmBtn.onclick = null;
    },
    showNotification: (message, isError = false) => {
        const title = isError ? 'Error' : 'Sukses';
        const body = `<p class="${isError ? 'text-red-400' : 'text-green-400'}">${utils.escapeHtml(message)}</p>`;
        utils.showModal({ title: title, body: body, confirmText: 'Tutup' });
    },
    renderTable: (container, data, options = {}) => {
        options.hiddenColumns = options.hiddenColumns || [];
        if (!data || data.length === 0) { container.innerHTML = `<p class="text-gray-400 p-4">${options.emptyMessage || 'Tidak ada data.'}</p>`; return; }
        const headers = Object.keys(data[0]);
        let html = `<div class="overflow-x-auto"><table class="min-w-full text-sm border-collapse border border-gray-700"><thead class="bg-gray-900"><tr>`;
        headers.forEach(h => { if (!options.hiddenColumns.includes(h)) html += `<th class="px-3 py-2 border-gray-700 text-left">${utils.escapeHtml(h)}</th>`; });
        if (options.action) { html += `<th class="px-3 py-2 border-gray-700 text-left">${options.action.label || 'Aksi'}</th>`; }
        html += `</tr></thead><tbody>`;
        data.forEach(item => {
            html += `<tr class="hover:bg-gray-700/50">`;
            headers.forEach(h => {
                if (!options.hiddenColumns.includes(h)) {
                    let val = item[h];
                    if (val && typeof val === 'object' && val.hasOwnProperty('_seconds')) {
                        val = new Date(val._seconds * 1000).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
                    } 
                    // REVISI DI SINI: Jika nilainya adalah string dan dimulai dengan '<', anggap itu HTML
                    else if (typeof val === 'string' && val.trim().startsWith('<')) {
                        // Jangan di-escape
                    } 
                    else { 
                        val = utils.escapeHtml(val); // Escape semua teks lainnya
                    }
                    html += `<td class="px-3 py-2 border-gray-700 align-top">${val}</td>`;
                }
            });
            if (options.action) { html += `<td class="px-3 py-2 border-gray-700 align-top">${options.action.render(item)}</td>`; }
            html += `</tr>`;
        });
        html += `</tbody></table></div>`;
        container.innerHTML = html;
    },
};