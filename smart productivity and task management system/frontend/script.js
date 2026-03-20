const API_URL = 'http://127.0.0.1:5000/api';

// Authentication Management
const auth = {
    setToken: (token) => localStorage.setItem('token', token),
    getToken: () => localStorage.getItem('token'),
    setUser: (user) => localStorage.setItem('user', JSON.stringify(user)),
    getUser: () => JSON.parse(localStorage.getItem('user')),
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    },
    isAuthenticated: () => !!localStorage.getItem('token')
};

// API Fetch Helper
async function apiCall(endpoint, method = 'GET', data = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = auth.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const config = { method, headers };
    if (data) config.body = JSON.stringify(data);

    try {
        const response = await fetch(`${API_URL}${endpoint}`, config);
        const result = await response.json();
        if (response.status === 401) auth.logout();
        return result;
    } catch (error) {
        console.error('API Error:', error);
        return { error: 'Failed to connect to server' };
    }
}

// Page Specific Logic
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const logoutBtn = document.getElementById('logoutBtn');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const res = await apiCall('/login', 'POST', {
                username: e.target.username.value,
                password: e.target.password.value
            });
            if (res.token) {
                auth.setToken(res.token);
                auth.setUser(res.user);
                window.location.href = 'dashboard.html';
            } else {
                alert(res.message || 'Login failed');
            }
        });
    }

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const res = await apiCall('/register', 'POST', {
                username: e.target.username.value,
                email: e.target.email.value,
                password: e.target.password.value
            });
            if (res.message === "User registered successfully") {
                alert('Registration successful! Please login.');
                window.location.href = 'login.html';
            } else {
                alert(res.message || 'Registration failed');
            }
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            auth.logout();
        });
    }

    if (window.location.pathname.includes('dashboard.html')) {
        if (!auth.isAuthenticated()) return window.location.href = 'login.html';
        initDashboard();
    }
});

// Dashboard Management
async function initDashboard() {
    const user = auth.getUser();
    document.getElementById('userNameDisplay').textContent = user.username;

    loadStats();
    loadTasks();
    initCharts();

    document.getElementById('taskForm').addEventListener('submit', handleTaskSubmit);
}

async function loadStats() {
    const stats = await apiCall('/dashboard-stats');
    if (stats.error) return;

    document.getElementById('totalTasks').textContent = stats.total;
    document.getElementById('completedTasks').textContent = stats.completed;
    document.getElementById('pendingTasks').textContent = stats.pending;
    document.getElementById('overdueTasks').textContent = stats.overdue;
    document.getElementById('smartRecommendation').textContent = `💡 Recommendation: ${stats.recommendation}`;
}

async function loadTasks() {
    const tasks = await apiCall('/tasks');
    const tbody = document.getElementById('taskTableBody');
    tbody.innerHTML = '';

    tasks.forEach(task => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${task.title}</td>
            <td><span class="priority-tag priority-${task.priority}">${task.priority}</span></td>
            <td>${task.deadline ? new Date(task.deadline).toLocaleDateString() : 'No Deadline'}</td>
            <td style="color: ${task.status === 'Completed' ? '#10b981' : '#f59e0b'}">${task.status}</td>
            <td style="display: flex; gap: 10px;">
                <button onclick="toggleTaskStatus(${task.id}, '${task.status === 'Completed' ? 'Pending' : 'Completed'}')" 
                        class="btn-outline" style="padding: 5px 10px; font-size: 0.8rem; cursor: pointer;">
                    ${task.status === 'Completed' ? 'Undo' : 'Done'}
                </button>
                <button onclick="deleteTask(${task.id})" class="btn-outline" 
                        style="padding: 5px 10px; font-size: 0.8rem; cursor: pointer; color: #ef4444;">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    const taskData = {
        title: document.getElementById('taskTitle').value,
        description: document.getElementById('taskDesc').value,
        priority: document.getElementById('taskPriority').value,
        deadline: document.getElementById('taskDeadline').value
    };

    const id = document.getElementById('taskId').value;
    const method = id ? 'PUT' : 'POST';
    const endpoint = id ? `/tasks/${id}` : '/tasks';

    await apiCall(endpoint, method, taskData);
    hideTaskModal();
    loadStats();
    loadTasks();
}

async function toggleTaskStatus(id, newStatus) {
    await apiCall(`/tasks/${id}`, 'PUT', { status: newStatus });
    loadStats();
    loadTasks();
}

async function deleteTask(id) {
    if (confirm('Delete this task?')) {
        await apiCall(`/tasks/${id}`, 'DELETE');
        loadStats();
        loadTasks();
    }
}

// Navigation & View Switching
function switchView(viewName, element) {
    // Hide all views
    document.querySelectorAll('.view-section').forEach(section => {
        section.style.display = 'none';
    });

    // Show selected view
    document.getElementById(`${viewName}View`).style.display = 'block';

    // Update nav-item active state
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('active');
    });
    if (element) element.classList.add('active');

    // Trigger specific view logic
    if (viewName === 'analytics') initAdvancedCharts();
    if (viewName === 'settings') loadSettings();
}

async function loadSettings() {
    const user = auth.getUser();
    if (user) {
        document.getElementById('settingsUsername').value = user.username;
        document.getElementById('settingsEmail').value = user.email;
    }
}

// Chart.js Setup
async function initCharts() {
    const stats = await apiCall('/dashboard-stats');
    if (stats.error) return;

    // Productivity Chart (Small Summary)
    const prodData = await apiCall('/productivity-data');
    const ctxProd = document.getElementById('productivityChart').getContext('2d');
    new Chart(ctxProd, {
        type: 'line',
        data: {
            labels: prodData.labels,
            datasets: [{
                label: 'Tasks Completed',
                data: prodData.completion_rate,
                borderColor: '#6366f1',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Status Chart
    const ctxStatus = document.getElementById('statusChart').getContext('2d');
    new Chart(ctxStatus, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'Pending', 'Overdue'],
            datasets: [{
                data: [stats.completed, stats.pending, stats.overdue],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } },
            cutout: '75%'
        }
    });
}

async function initAdvancedCharts() {
    // Productivity Trend (Advanced)
    const ctxAdv = document.getElementById('advancedAnalyticsChart').getContext('2d');
    new Chart(ctxAdv, {
        type: 'bar',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Efficiency %',
                data: [65, 78, 82, 91],
                backgroundColor: 'rgba(139, 92, 246, 0.5)',
                borderColor: '#8b5cf6',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // Category Focus
    const ctxCat = document.getElementById('categoryChart').getContext('2d');
    new Chart(ctxCat, {
        type: 'polarArea',
        data: {
            labels: ['Work', 'Personal', 'Health', 'Finance'],
            datasets: [{
                data: [12, 19, 3, 5],
                backgroundColor: [
                    'rgba(99, 102, 241, 0.5)',
                    'rgba(236, 72, 153, 0.5)',
                    'rgba(16, 185, 129, 0.5)',
                    'rgba(245, 158, 11, 0.5)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            plugins: { legend: { display: false } },
            scales: { r: { grid: { color: 'rgba(255,255,255,0.05)' } } }
        }
    });
}

// UI Helpers
function showTaskModal() {
    document.getElementById('taskModal').style.display = 'flex';
}

function hideTaskModal() {
    document.getElementById('taskModal').style.display = 'none';
    document.getElementById('taskForm').reset();
    document.getElementById('taskId').value = '';
}
