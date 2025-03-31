// logs.js

function initializeLogsPage() {
    loadLogs();
    
    // Add event listeners
    document.getElementById('refresh-logs').addEventListener('click', loadLogs);
    document.getElementById('clear-logs').addEventListener('click', clearLogs);
}

function loadLogs() {
    fetch('/data/system_log.json')
        .then(response => {
            if (!response.ok) {
                throw new Error('Errore nel caricamento dei log');
            }
            return response.json();
        })
        .then(logs => {
            displayLogs(logs);
        })
        .catch(error => {
            console.error('Errore nel caricamento dei log:', error);
            showToast('Errore nel caricamento dei log', 'error');
            displayLogs([]);
        });
}

function displayLogs(logs) {
    const logList = document.getElementById('log-list');
    
    if (!logs || logs.length === 0) {
        logList.innerHTML = '<div class="empty-logs">Nessun log disponibile</div>';
        return;
    }
    
    // Sort logs by date and time (newest first)
    logs.sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`);
        const dateB = new Date(`${b.date} ${b.time}`);
        return dateB - dateA;
    });
    
    // Create log entries
    logList.innerHTML = logs.map(log => `
        <div class="log-entry">
            <div class="log-date">${log.date || 'N/A'}</div>
            <div class="log-time">${log.time || 'N/A'}</div>
            <div class="log-level ${log.level || 'INFO'}">${log.level || 'INFO'}</div>
            <div class="log-message">${log.message || 'Nessun messaggio'}</div>
        </div>
    `).join('');
}

function clearLogs() {
    if (!confirm('Sei sicuro di voler cancellare tutti i log di sistema?')) {
        return;
    }
    
    fetch('/clear_logs', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('Log cancellati con successo', 'success');
            loadLogs(); // Reload logs (should be empty now)
        } else {
            showToast('Errore durante la cancellazione dei log: ' + (data.error || ''), 'error');
        }
    })
    .catch(error => {
        console.error('Errore durante la cancellazione dei log:', error);
        showToast('Errore di rete durante la cancellazione dei log', 'error');
    });
}

// Function to show toast notifications
function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        // Fallback if global function is not available
        console.log(`Toast: ${type} - ${message}`);
    }
}

// Initialize page when document is loaded
document.addEventListener('DOMContentLoaded', initializeLogsPage);