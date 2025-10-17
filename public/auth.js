// public/auth.js
const auth = {
    getFreshToken: async () => {
        return new Promise((resolve, reject) => {
            const unsubscribe = firebase.auth().onAuthStateChanged(user => {
                unsubscribe();
                if (user) {
                    user.getIdToken(true).then(resolve).catch(reject);
                } else {
                    resolve(null); // Tidak login, kembalikan null
                }
            });
        });
    },
    getAuthHeaders: async (requireAuth = true) => {
        const token = await auth.getFreshToken();
        if (token) {
            return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
        }
        if (requireAuth) {
            // Jika aksi butuh login tapi tidak ada token, paksa logout
            auth.logout();
        }
        return { 'Content-Type': 'application/json' };
    },
    logout: () => {
        firebase.auth().signOut().then(() => {
            window.location.href = '/login.html';
        });
    },
    getUser: async () => {
        const token = await auth.getFreshToken();
        if (!token) return null; // Jika tidak login, kembalikan null
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            const response = await fetch('/api/user', { headers });
            if (!response.ok) return null;
            return await response.json();
        } catch (error) {
            console.error("Gagal mendapatkan info user:", error);
            return null;
        }
    }
};