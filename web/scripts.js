// scripts.js

let isLoadingPage = false;
let userData = {};
let connectionStatusInterval = null;

// Funzione per mostrare notifiche (toast)
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    
    // Rimuovi eventuali toast esistenti con lo stesso messaggio
    const existingToasts = container.querySelectorAll('.toast');
    existingToasts.forEach(toast => {
        if (toast.textContent === message) {
            toast.remove();
        }
    });
    
    // Crea un nuovo toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Aggiungi al container
    container.appendChild(toast);
    
    // Renderizza e avvia l'animazione
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Rimuovi dopo la durata specificata
    const timerId = setTimeout(() => {
        toast.classList.remove('show');
        
        // Rimuovi l'elemento dopo che l'animazione è completata
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    }, duration);
    
    // Permetti di chiudere il toast cliccandolo
    toast.addEventListener('click', () => {
        clearTimeout(timerId);
        toast.classList.remove('show');
        
        setTimeout(() => {
            if (container.contains(toast)) {
                container.removeChild(toast);
            }
        }, 300);
    });
    
    // Esponi la funzione globalmente
    window.showToast = showToast;
}

// Funzione per caricare i dati da user_settings.json una sola volta
function loadUserData(callback) {
    fetch('/data/user_settings.json')
        .then(response => {
            if (!response.ok) throw new Error('Errore nel caricamento dei dati di user_settings');
            return response.json();
        })
        .then(data => {
            userData = data;
            console.log("Dati utente caricati:", userData);
            if (callback) callback();
        })
        .catch(error => {
            console.error('Errore nel caricamento dei dati di user_settings:', error);
            showToast('Errore nel caricamento delle impostazioni', 'error');
        });
}

function loadPage(page, callback) {
    if (isLoadingPage) return;
    isLoadingPage = true;

    fetch(page)
        .then(response => {
            if (!response.ok) throw new Error('Errore nel caricamento della pagina');
            return response.text();
        })
        .then(html => {
            const contentElement = document.getElementById('content');
            if (contentElement) {
                contentElement.innerHTML = html;

                // Ferma il polling prima di caricare qualsiasi altra pagina
                stopConnectionStatusPolling();

                // Carica gli script associati alla pagina
                switch (page) {
                    case 'manual.html':
                        loadScript('manual.js', () => {
                            if (typeof initializeManualPage === 'function') {
                                initializeManualPage(userData);
                            }
                        });
                        break;
                    case 'create_program.html':
                        loadScript('create_program.js', () => {
                            if (typeof initializeCreateProgramPage === 'function') {
                                initializeCreateProgramPage();
                            }
                        });
                        break;
                    case 'modify_program.html':
                        loadScript('modify_program.js', () => {
                            if (typeof initializeModifyProgramPage === 'function') {
                                initializeModifyProgramPage();
                            }
                        });
                        break;
                    case 'settings.html':
                        loadScript('settings.js', () => {
                            if (typeof initializeSettingsPage === 'function') {
                                initializeSettingsPage(userData);
                            }
                            // Avvia il polling dello stato della connessione solo se sei nella pagina Impostazioni
                            startConnectionStatusPolling();
                        });
                        break;
                    case 'view_programs.html':
                        loadScript('view_programs.js', () => {
                            if (typeof initializeViewProgramsPage === 'function') {
                                initializeViewProgramsPage();
                            }
                        });
                        break;
                    case 'logs.html':
                        loadScript('logs.js', () => {
                            if (typeof initializeLogsPage === 'function') {
                                initializeLogsPage();
                            }
                        });
                        break;
                }

                if (callback && typeof callback === 'function') {
                    callback();
                }
            } else {
                console.error("Elemento con ID 'content' non trovato.");
                showToast("Errore nell'inizializzazione della pagina", 'error');
            }
        })
        .catch(error => {
            console.error('Errore nel caricamento della pagina:', error);
            showToast(`Errore nel caricamento di ${page}`, 'error');
        })
        .finally(() => {
            isLoadingPage = false;
        });
}

// Funzione per caricare uno script
function loadScript(url, callback) {
    const script = document.createElement('script');
    script.src = url;
    script.onload = callback;
    document.head.appendChild(script);
}

function toggleMenu() {
    const menu = document.getElementById('menu');
    menu.classList.toggle('active');
}

function closeMenu() {
    const menu = document.getElementById('menu');
    menu.classList.remove('active');
}

function updateDateTime() {
    const dateElement = document.getElementById('date');
    const timeElement = document.getElementById('time');

    const now = new Date();
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    const formattedDate = now.toLocaleDateString('it-IT', options);
    const formattedTime = now.toLocaleTimeString('it-IT');

    if (dateElement) dateElement.textContent = formattedDate;
    if (timeElement) timeElement.textContent = formattedTime;
}

// Funzioni per il polling dello stato della connessione
function startConnectionStatusPolling() {
    if (connectionStatusInterval) {
        clearInterval(connectionStatusInterval);
    }
    
    // Esegui subito
    fetchConnectionStatus();
    
    // Poi esegui ogni 30 secondi
    connectionStatusInterval = setInterval(fetchConnectionStatus, 30000);
    console.log("Polling dello stato della connessione avviato");
}

function stopConnectionStatusPolling() {
    if (connectionStatusInterval) {
        clearInterval(connectionStatusInterval);
        connectionStatusInterval = null;
        console.log("Polling dello stato della connessione fermato");
    }
}

function fetchConnectionStatus() {
    fetch('/get_connection_status')
        .then(response => {
            if (!response.ok) throw new Error('Errore nel caricamento dello stato della connessione');
            return response.json();
        })
        .then(data => {
            const statusElement = document.getElementById('connection-status');
            if (statusElement) {
                let statusHtml = '';
                
                if (data.mode === 'client') {
                    statusHtml = `
                        <strong>Modalità:</strong> Client WiFi<br>
                        <strong>SSID:</strong> ${data.ssid}<br>
                        <strong>IP:</strong> ${data.ip}
                    `;
                } else if (data.mode === 'AP') {
                    statusHtml = `
                        <strong>Modalità:</strong> Access Point<br>
                        <strong>SSID:</strong> ${data.ssid}<br>
                        <strong>IP:</strong> ${data.ip}
                    `;
                } else {
                    statusHtml = 'Nessuna connessione attiva';
                }
                
                statusElement.innerHTML = statusHtml;
                statusElement.style.display = 'block';
            }
        })
        .catch(error => {
            console.error('Errore nel caricamento dello stato della connessione:', error);
            // Non mostrare toast per evitare troppe notifiche
        });
}

function initializePage() {
    updateDateTime();
    setInterval(updateDateTime, 1000);

    loadUserData(() => {
        loadPage('manual.html');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // Inizializza la pagina principale
    initializePage();

    // Gestisci i click sui link di navigazione
    document.querySelectorAll('.menu li').forEach(item => {
        item.addEventListener('click', (event) => {
            const targetPage = event.target.dataset.page;
            loadPage(targetPage);
            closeMenu();
        });
    });

    // Aggiungi listener per chiudere il menu quando si clicca altrove
    document.body.addEventListener('click', (e) => {
        const menu = document.getElementById('menu');
        const menuIcon = document.querySelector('.menu-icon');

        // Chiudi il menu solo se è attivo e il clic non è sul menu o sull'icona del menu
        if (menu && menu.classList.contains('active') && !menu.contains(e.target) && !menuIcon.contains(e.target)) {
            closeMenu();
        }
    });
});

// Funzione per fermare tutti i programmi in esecuzione
function stopAllPrograms() {
    fetch('/stop_program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('Arresto totale eseguito con successo', 'success');
        } else {
            showToast(`Errore durante l'arresto totale: ${data.error}`, 'error');
        }
    })
    .catch(error => {
        console.error('Errore di rete durante l\'arresto totale:', error);
        showToast('Errore di rete durante l\'arresto totale', 'error');
    });
}