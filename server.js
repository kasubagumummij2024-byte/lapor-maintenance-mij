// === server.js (Final & Lengkap) ===

const express = require('express');
const admin = require('firebase-admin');
const XLSX = require('xlsx');
const path = require('path'); // DITAMBAHKAN: Modul 'path' untuk file

const app = express();
app.use(express.json());
// Diperbarui untuk best practice
app.use(express.static(path.join(__dirname, 'public')));

// Route untuk halaman utama (Index.html) yang bisa dilihat semua orang
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'Index.html'));
});

// Route untuk halaman login (jika diakses manual)
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// KODE BARU (UNTUK DEPLOY)
let serviceAccount;

if (process.env.GOOGLE_CREDENTIALS_JSON) {
  // Jika berjalan di Railway, baca dari environment variable
  serviceAccount = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
} else {
  // Jika berjalan di lokal, baca dari file
  serviceAccount = require("./serviceAccountKey.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// DITAMBAHKAN: Inisialisasi Firestore
const db = admin.firestore();

// --- Middleware (Penjaga Keamanan) ---
const checkAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    const idToken = req.headers.authorization.split('Bearer ')[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken;
      const userDoc = await db.collection('users').doc(req.user.uid).get(); // 'db' sekarang terdefinisi
      req.user.role = userDoc.exists ? userDoc.data().role : 'User'; // Default role 'User'
      return next();
    } catch (error) {
      console.error('Error saat verifikasi token:', error.code);
      return res.status(403).json({ error: 'Unauthorized' });
    }
  } else {
    return res.status(401).json({ error: 'No token provided.' });
  }
};

function generateTicketID() {
  const d = new Date();
  const ds = new Date(d.getTime() - (d.getTimezoneOffset() * 60000 )).toISOString().slice(0, 19).replace(/[-T:]/g, "");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `MIJ-${ds}-${rand}`;
}

// --- API Endpoints ---

// Endpoint untuk info user yang sedang login (dilindungi)
app.get('/api/user', checkAuth, (req, res) => {
    res.status(200).json({ email: req.user.email, role: req.user.role, uid: req.user.uid });
});

// Endpoint untuk mengirim laporan (PUBLIK)
app.post('/api/reports', async (req, res) => {
    try {
        const newReportData = { ...req.body, ticketId: generateTicketID(), status: 'Menunggu Penugasan', timestamp: new Date(), assignedTo: '', assignedAt: null, lastUpdateAt: new Date(), tglSelesai: '', catatanPenutup: '' };
        const docRef = await db.collection('reports').add(newReportData); // 'db' sekarang terdefinisi
        res.status(201).json({ success: true, ticket: newReportData.ticketId, id: docRef.id });
    } catch (error) { console.error("Error creating report:", error); res.status(500).json({ error: "Gagal menyimpan laporan." }); }
});

// Endpoint untuk mengambil laporan (SEKARANG PUBLIK)
app.get('/api/reports', async (req, res) => {
    try {
        let query = db.collection('reports'); // 'db' sekarang terdefinisi
        if (req.query.status && req.query.status !== 'Semua') { const statuses = req.query.status.split(','); query = query.where('status', statuses.length > 1 ? 'in' : '==', statuses.length > 1 ? statuses : statuses[0]); }
        if (req.query.urgensi && req.query.urgensi !== 'Semua') { query = query.where('urgensi', '==', req.query.urgensi); }
        if (req.query.month) { const [year, month] = req.query.month.split('-').map(Number); const startDate = new Date(year, month - 1, 1); const endDate = new Date(year, month, 0, 23, 59, 59); query = query.where('timestamp', '>=', startDate).where('timestamp', '<=', endDate); }
        
        const snapshot = await query.orderBy('timestamp', 'desc').get();
        const reports = [];
        snapshot.forEach(doc => { reports.push({ id: doc.id, ...doc.data() }); });
        
        res.status(200).json(reports); // Mengirim data laporan saja
    } catch (error) { 
        console.error("Error fetching reports:", error); 
        res.status(500).json({ error: "Gagal mengambil data. Kemungkinan membutuhkan indeks Firestore." }); 
    }
});

// Endpoint untuk update laporan (DILINDUNGI)
app.put('/api/reports/:docId', checkAuth, async (req, res) => {
    const userRole = req.user.role;
    if (userRole !== 'Kasubag' && userRole !== 'Petugas') {
        return res.status(403).json({ error: 'Aksi tidak diizinkan untuk peran Anda.' });
    }
    try {
        const { docId } = req.params;
        const updateData = req.body;
        updateData.lastUpdateAt = new Date();
        if (updateData.status === 'Selesai' && !updateData.tglSelesai) {
            updateData.tglSelesai = new Date().toISOString().split('T')[0];
        }
        await db.collection('reports').doc(docId).update(updateData); // 'db' sekarang terdefinisi
        res.status(200).json({ success: true });
    } catch (error) { console.error(`Error updating report ${req.params.docId}:`, error); res.status(500).json({ error: "Gagal mengupdate laporan." }); }
});

// Endpoint untuk Ekspor Excel (DILINDUNGI & HANYA KASUBAG)
app.get('/api/reports/export', checkAuth, async (req, res) => {
    if (req.user.role !== 'Kasubag') {
        return res.status(403).send('Akses ditolak. Hanya Kasubag yang bisa mengunduh laporan.');
    }
    try {
        let query = db.collection('reports'); // 'db' sekarang terdefinisi
        if (req.query.status && req.query.status !== 'Semua') { const statuses = req.query.status.split(','); query = query.where('status', statuses.length > 1 ? 'in' : '==', statuses.length > 1 ? statuses : statuses[0]); }
        if (req.query.month) { const [year, month] = req.query.month.split('-').map(Number); const startDate = new Date(year, month - 1, 1); const endDate = new Date(year, month, 0, 23, 59, 59); query = query.where('timestamp', '>=', startDate).where('timestamp', '<=', endDate); }
        const snapshot = await query.orderBy('timestamp', 'desc').get();
        
        if (snapshot.empty) { return res.status(404).send("Tidak ada data untuk diekspor."); }

        const dataForExcel = snapshot.docs.map(doc => {
            const data = doc.data();
            const formatDate = (ts) => ts && ts._seconds ? new Date(ts._seconds * 1000).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '-';
            return {
                "Ticket ID": data.ticketId, "Waktu Laporan": formatDate(data.timestamp), "Status": data.status,
                "Pelapor": data.pelapor, "Unit": data.unit, "Kategori": data.kategori, "Lokasi": data.lokasi,
                "Deskripsi": data.deskripsi, "Urgensi": data.urgensi, "Ditugaskan Kepada": data.assignedTo || '-',
                "Waktu Ditugaskan": formatDate(data.assignedAt), "Update Terakhir": formatDate(data.lastUpdateAt),
                "Tanggal Selesai": data.tglSelesai || '-', "Catatan Petugas": data.catatanPenutup || '-'
            };
        });

        const worksheet = XLSX.utils.json_to_sheet(dataForExcel);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan");
        worksheet["!cols"] = [ { width: 25 }, { width: 20 }, { width: 15 }, { width: 20 }, { width: 20 }, { width: 20 }, { width: 25 }, { width: 40 }, { width: 15 }, { width: 25 }, { width: 20 }, { width: 20 }, { width: 15 }, { width: 40 } ];
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        res.setHeader('Content-Disposition', `attachment; filename="Laporan_${req.query.month || 'Semua'}.xlsx"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(excelBuffer);
    } catch (error) { console.error("Error exporting to Excel:", error); res.status(500).send("Gagal mengekspor data."); }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});