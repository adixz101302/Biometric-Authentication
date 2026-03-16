import { getUsers, getLogs, deleteIdentity } from './firebase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    loadLogs();
    
    // Refresh logs every 10 seconds
    setInterval(loadLogs, 10000);

    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('adminAuth');
        window.location.href = 'index.html';
    });
});

async function loadUsers() {
    try {
        const users = await getUsers();
        const tbody = document.querySelector('#usersTable tbody');
        tbody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.name}</td>
                <td style="font-family: monospace;">${user.email}</td>
                <td><button class="delete-btn" data-id="${user.id}"><i class="fa-solid fa-trash"></i></button></td>
            `;
            tbody.appendChild(row);
        });

        // Add delete listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm(`Erase identity ID ${id} from secure Cloud Storage?`)) {
                    await deleteIdentity(id);
                    loadUsers();
                    loadLogs();
                }
            });
        });
    } catch (err) {
        console.error("Error loading users", err);
    }
}

async function loadLogs() {
    try {
        const logs = await getLogs();
        const tbody = document.querySelector('#logsTable tbody');
        tbody.innerHTML = '';
        
        logs.forEach(log => {
            const row = document.createElement('tr');
            const statusClass = log.status === 'success' ? 'badge-success' : 'badge-error';
            const identity = log.email ? log.email : '<span style="color:var(--neon-red)">Unknown</span>';
            
            // Format timestamp from Firebase
            let dateStr = 'Unknown';
            if (log.timestamp) {
                dateStr = log.timestamp.toDate().toLocaleString();
            }

            row.innerHTML = `
                <td>${identity}</td>
                <td style="text-transform: uppercase;">${log.action}</td>
                <td><span class="badge ${statusClass}">${log.status}</span></td>
                <td style="font-family: monospace; font-size: 0.85rem; color: var(--neon-blue);">${log.ip_address || 'Unknown'}</td>
                <td style="font-size: 0.8rem; color: var(--text-secondary);">${dateStr}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (err) {
        console.error("Error loading logs", err);
    }
}
