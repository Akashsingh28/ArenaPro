// ── API Configuration ─────────────────────────────────────────────────────────
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:5000/api' 
    : 'https://arenapro-backend-eqxg.onrender.com/api'; // Render backend URL

// ── Auth Helpers ──────────────────────────────────────────────────────────────
const auth = {
    getToken: () => localStorage.getItem('ap_token'),
    setToken: (t) => localStorage.setItem('ap_token', t),
    getUser:  () => {
        const u = localStorage.getItem('ap_user');
        return u ? JSON.parse(u) : null;
    },
    setUser:  (u) => localStorage.setItem('ap_user', JSON.stringify(u)),
    logout:   async (redirectTo = 'index.html') => {
        try {
            if (auth.isLoggedIn()) {
                await apiFetch('/auth/logout', { method: 'POST' });
            }
        } catch (e) {
            console.error('Logout failed on backend:', e);
        }
        localStorage.removeItem('ap_token');
        localStorage.removeItem('ap_user');
        if (redirectTo) window.location.href = redirectTo;
    },
    mergeUser: (updates) => {
        const currentUser = auth.getUser() || {};
        const nextUser = { ...currentUser, ...updates };
        localStorage.setItem('ap_user', JSON.stringify(nextUser));
        return nextUser;
    },
    isLoggedIn: () => !!localStorage.getItem('ap_token'),
    isAdmin:    () => {
        const u = auth.getUser();
        return u && u.role === 'admin';
    },
    verifyAdminAuth: async () => {
        // Specifically used to secure the admin layout
        try {
            const data = await apiFetch('/auth/me');
            if (data.success && data.user && data.user.role === 'admin') {
                auth.setUser(data.user);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }
};

// ── API Fetch Helper ──────────────────────────────────────────────────────────
async function apiFetch(endpoint, options = {}) {
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options
    };
    const token = auth.getToken();
    if (token) config.headers['Authorization'] = `Bearer ${token}`;

    let response;

    try {
        response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    } catch (error) {
        throw new Error('Cannot connect to the server. Make sure the backend is running on http://localhost:5000.');
    }

    let data = null;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        data = await response.json();
    } else {
        const text = await response.text();
        data = { message: text || 'Server returned an unexpected response' };
    }

    if (!response.ok) {
        const error = new Error(data.message || 'Server error');
        error.status = response.status;
        if (data && data.code) error.code = data.code;
        throw error;
    }
    return data;
}

// ── Navbar Active State ───────────────────────────────────────────────────────
function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'index.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Update login button to show username when logged in
function updateNavbar() {
    const loginBtn = document.querySelector('a.btn-primary[href="login.html"]');
    if (loginBtn && auth.isLoggedIn()) {
        const user = auth.getUser();
        if (user) {
            loginBtn.innerHTML = `<span class="nav-icon">👤</span> ${user.username}`;
            loginBtn.href = user.role === 'admin' ? 'admin.html' : 'player-profile.html';
        }
    }
    
    // Check notifications if logged in
    if (auth.isLoggedIn()) {
        const countBadge = document.getElementById('nav-notif-count');
        if (countBadge) {
            countBadge.style.display = 'inline-block';
            countBadge.textContent = '!'; // Simplified indicator
        }
    }
}

// ── Notifications ─────────────────────────────────────────────────────────────
async function toggleNotifications(e) {
    e.preventDefault();
    const dropdown = document.getElementById('notifications-dropdown');
    if (!dropdown) return;
    
    if (dropdown.style.display === 'none') {
        dropdown.style.display = 'block';
        if (!auth.isLoggedIn()) {
            document.getElementById('notifications-list').innerHTML = '<div style="text-align:center;color:var(--color-text-secondary);font-size:0.875rem;">Please login to view notifications</div>';
            return;
        }
        
        try {
            const data = await apiFetch('/notifications');
            const notifications = data.data || [];
            
            if (notifications.length === 0) {
                document.getElementById('notifications-list').innerHTML = '<div style="text-align:center;color:var(--color-text-secondary);font-size:0.875rem;">No new notifications</div>';
                return;
            }
            
            document.getElementById('notifications-list').innerHTML = notifications.map(n => `
                <div style="background:rgba(255,255,255,0.03);padding:10px;border-radius:6px;border-left:3px solid var(--color-primary);">
                    <div style="font-weight:bold;font-size:0.85rem;margin-bottom:4px;">${n.title}</div>
                    <div style="font-size:0.8rem;color:var(--color-text-secondary);">${n.message}</div>
                    <div style="font-size:0.7rem;color:#888;margin-top:4px;text-align:right;">${new Date(n.createdAt).toLocaleDateString()}</div>
                </div>
            `).join('');
        } catch (err) {
            document.getElementById('notifications-list').innerHTML = `<div style="color:#ff4757;font-size:0.875rem;text-align:center;">Error loading notifications</div>`;
        }
    } else {
        dropdown.style.display = 'none';
    }
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('notifications-dropdown');
    const btn = document.getElementById('nav-notifications-btn');
    if (dropdown && dropdown.style.display === 'block') {
        if (!dropdown.contains(e.target) && (!btn || !btn.contains(e.target))) {
            dropdown.style.display = 'none';
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    setActiveNavLink();
    updateNavbar();
});

// ── Smooth Scroll ─────────────────────────────────────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const targetSelector = this.getAttribute('href');
        const target = targetSelector ? document.querySelector(targetSelector) : null;
        if (target) {
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    });
});

// ── Scroll Animation ──────────────────────────────────────────────────────────
const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.tournament-card, .game-card, .feature-card, .step-card').forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });
});
