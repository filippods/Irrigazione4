// Variabile per il polling dello stato dei programmi
let programStatusInterval = null;

function initializeViewProgramsPage() {
    loadUserSettingsAndPrograms();
    
    // Avvia polling dello stato dei programmi
    startProgramStatusPolling();
    
    // Pulisci quando l'utente lascia la pagina
    window.addEventListener('beforeunload', stopProgramStatusPolling);
}

function startProgramStatusPolling() {
    // Prima chiamata immediata
    fetchProgramState();
    
    // Poi ogni 3 secondi
    programStatusInterval = setInterval(fetchProgramState, 3000);
}

function stopProgramStatusPolling() {
    if (programStatusInterval) {
        clearInterval(programStatusInterval);
        programStatusInterval = null;
    }
}

function fetchProgramState() {
    fetch('/get_program_state')
        .then(response => {
            if (!response.ok) throw new Error('Errore nel recupero dello stato del programma');
            return response.json();
        })
        .then(state => {
            updateProgramsUI(state);
        })
        .catch(error => {
            console.error('Errore nel recupero dello stato del programma:', error);
        });
}

function updateProgramsUI(state) {
    const currentProgramId = state.current_program_id;
    const programRunning = state.program_running;
    
    // Aggiorna tutte le card dei programmi
    document.querySelectorAll('.program-card').forEach(card => {
        const cardProgramId = card.getAttribute('data-program-id');
        const isActive = programRunning && cardProgramId === currentProgramId;
        
        // Aggiorna classe attiva
        if (isActive) {
            card.classList.add('active-program');
            
            // Aggiungi indicatore se non esiste
            if (!card.querySelector('.active-indicator')) {
                const indicator = document.createElement('div');
                indicator.className = 'active-indicator';
                indicator.textContent = 'Programma in esecuzione';
                card.querySelector('h3').insertAdjacentElement('afterend', indicator);
            }
        } else {
            card.classList.remove('active-program');
            
            // Rimuovi indicatore se esiste
            const indicator = card.querySelector('.active-indicator');
            if (indicator) {
                indicator.remove();
            }
        }
        
        // Aggiorna pulsanti
        const onBtn = card.querySelector('.on-btn');
        const offBtn = card.querySelector('.off-btn');
        
        if (onBtn && offBtn) {
            if (isActive) {
                onBtn.classList.add('active');
                onBtn.classList.remove('inactive');
                offBtn.classList.add('inactive');
                offBtn.classList.remove('active');
            } else {
                onBtn.classList.remove('active');
                onBtn.classList.add('inactive');
                offBtn.classList.remove('inactive');
                offBtn.classList.add('active');
            }
            
            // Disabilita tutti i pulsanti ON se c'è un programma in esecuzione ma non è questo
            if (programRunning && !isActive) {
                onBtn.disabled = true;
                onBtn.title = 'Non puoi avviare un programma mentre un altro è in esecuzione';
            } else {
                onBtn.disabled = false;
                onBtn.title = '';
            }
        }
    });
}

function loadUserSettingsAndPrograms() {
    showLoading();
    
    // Carica le impostazioni utente per ottenere i nomi delle zone
    fetch('/data/user_settings.json')
        .then(response => {
            if (!response.ok) throw new Error('Errore nel caricamento delle impostazioni utente');
            return response.json();
        })
        .then(userSettings => {
            const zones = userSettings.zones;

            // Carica anche i programmi
            return fetch('/data/program.json')
                .then(response => {
                    if (!response.ok) throw new Error('Errore nel caricamento dei programmi');
                    return response.json();
                })
                .then(programs => fetch('/get_program_state')
                    .then(response => {
                        if (!response.ok) throw new Error('Errore nel caricamento dello stato del programma');
                        return response.json();
                    })
                    .then(state => ({ programs, state, zones }))
                );
        })
        .then(({ programs, state, zones }) => {
            renderProgramCards(programs, state.current_program_id, zones);
            hideLoading();
        })
        .catch(error => {
            console.error('Errore nel caricamento dei dati:', error);
            showToast('Errore nel caricamento dei dati', 'error');
            hideLoading();
        });
}

function showLoading() {
    const container = document.getElementById('program-container');
    if (container) {
        container.innerHTML = '<div class="loading">Caricamento programmi...</div>';
    }
}

function hideLoading() {
    const loading = document.querySelector('.loading');
    if (loading) {
        loading.remove();
    }
}

function renderProgramCards(programs, currentProgramId, zones) {
    const container = document.getElementById('program-container');
    if (!container) {
        console.error("Elemento 'program-container' non trovato nel DOM.");
        return;
    }

    if (Object.keys(programs).length === 0) {
        container.innerHTML = `
            <div class="no-program-message" style="text-align:center;padding:20px;color:#666">
                Nessun programma in memoria.
                <br><br>
                <button onclick="window.location.href='create_program.html'" class="on-btn" style="background-color:#0099ff">Crea Nuovo Programma</button>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    
    // Recupera lo stato di attivazione automatica
    fetch('/data/user_settings.json')
        .then(response => response.json())
        .then(settings => {
            const autoEnabled = settings.automatic_programs_enabled || false;
            
            // Ora renderizza i programmi con lo stato corretto
            Object.entries(programs).forEach(([programId, program]) => {
                if (!program.id) {
                    program.id = programId;
                }

                const isActive = program.id === currentProgramId;

                const zoneNames = (program.steps || []).map(step => {
                    const zone = zones.find(z => z.id === step.zone_id);
                    const zoneName = zone ? zone.name : `Zona ${step.zone_id}`;
                    return `<li class="active-zone">${zoneName} (${step.duration} min)</li>`;
                }).join('');

                const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
                const monthDisplay = months.map(month => {
                    const isActiveMonth = (program.months || []).includes(month);
                    return `<li class="${isActiveMonth ? 'active-zone' : 'inactive-zone'}">${month}</li>`;
                }).join('');

                const lastRunDate = program.last_run_date || 'Mai eseguito';
                const recurrence = program.recurrence === 'giornaliero' ? 'Ogni giorno' : 
                                program.recurrence === 'giorni_alterni' ? 'Giorni alterni' : 
                                program.recurrence === 'personalizzata' ? `Ogni ${program.interval_days || 1} giorni` : 
                                program.recurrence;

                const programCard = document.createElement('div');
                programCard.className = `program-card ${isActive ? 'active-program' : ''}`;
                programCard.setAttribute('data-program-id', program.id);
                programCard.innerHTML = `
                    <h3 style="background: #0099ff; color: white; padding: 10px; border-radius: 8px;">${program.name}</h3>
                    ${isActive ? '<div class="active-indicator">Programma in esecuzione</div>' : ''}
                    <div class="section">
                        <div class="section-title">Orario di Attivazione:</div>
                        <div class="section-content">${program.activation_time || '00:00'}</div>
                    </div>
                    <div class="section">
                        <div class="section-title">Cadenza:</div>
                        <div class="section-content">${recurrence}</div>
                    </div>
                    <div class="section">
                        <div class="section-title">Ultima Data di Avvio:</div>
                        <div class="section-content">${lastRunDate}</div>
                    </div>
                    <div class="section">
                        <div class="section-title">Mesi Attivi</div>
                        <ul class="months-list">
                            ${monthDisplay}
                        </ul>
                    </div>
                    <div class="section">
                        <div class="section-title">Zone</div>
                        <ul class="zone-list">
                            ${zoneNames}
                        </ul>
                    </div>
                    <div class="btn-group">
                        <div class="on-off-group">
                            <button class="on-btn ${isActive ? 'active' : 'inactive'}" onclick="startProgram('${program.id}')">Avvia ora</button>
                            <button class="off-btn ${isActive ? 'inactive' : 'active'}" onclick="stopProgram()">STOP</button>
                        </div>
                        <div class="auto-group">
                            <button class="auto-enable ${autoEnabled ? 'active' : ''}" onclick="toggleAutomaticPrograms(true)">Auto ON</button>
                            <button class="auto-disable ${!autoEnabled ? 'active' : ''}" onclick="toggleAutomaticPrograms(false)">Auto OFF</button>
                        </div>
                        <div class="edit-delete-group">
                            <button class="edit-btn" onclick="editProgram('${program.id}')">Modifica</button>
                            <button class="delete-btn" onclick="deleteProgram('${program.id}')">Elimina</button>
                        </div>
                    </div>
                `;
                container.appendChild(programCard);
            });
        });
}

function toggleAutomaticPrograms(enable) {
    showToast(`${enable ? 'Attivazione' : 'Disattivazione'} programmi automatici...`, 'info');
    
    fetch('/toggle_automatic_programs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: enable })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(`Programmi automatici ${enable ? 'attivati' : 'disattivati'} con successo`, 'success');
            
            // Aggiorna lo stato dei pulsanti
            document.querySelectorAll('.auto-enable').forEach(btn => {
                btn.classList.toggle('active', enable);
            });
            
            document.querySelectorAll('.auto-disable').forEach(btn => {
                btn.classList.toggle('active', !enable);
            });
        } else {
            showToast(`Errore: ${data.error || 'Errore sconosciuto'}`, 'error');
        }
    })
    .catch(error => {
        console.error('Errore durante la modifica dello stato dei programmi automatici:', error);
        showToast('Errore di rete', 'error');
    });
}

// Altre funzioni aggiornate
async function startProgram(programId) {
    showToast('Avvio programma in corso...', 'info');
    
    try {
        const response = await fetch('/start_program', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ program_id: programId })
        });
        
        const data = await response.json();

        if (!data.success) {
            showToast(`Errore nell'avvio del programma: ${data.error || 'Errore sconosciuto'}`, 'error');
        } else {
            showToast('Programma avviato con successo', 'success');
            // Aggiorna immediatamente l'interfaccia
            fetchProgramState();
        }
    } catch (error) {
        console.error("Errore di rete durante l'avvio del programma:", error);
        showToast("Errore di rete durante l'avvio del programma", 'error');
    }
}

function stopProgram() {
    showToast('Arresto programma in corso...', 'info');
    
    fetch('/stop_program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            showToast(`Errore nell'arresto del programma: ${data.error || 'Errore sconosciuto'}`, 'error');
        } else {
            showToast('Programma arrestato con successo', 'success');
            // Aggiorna immediatamente l'interfaccia
            fetchProgramState();
        }
    })
    .catch(error => {
        console.error("Errore di rete durante l'arresto del programma:", error);
        showToast("Errore di rete durante l'arresto del programma", 'error');
    });
}

function deleteProgram(programId) {
    if (confirm(`Sei sicuro di voler eliminare il programma? Questa operazione non può essere annullata.`)) {
        showToast('Eliminazione in corso...', 'info');
        
        fetch('/delete_program', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: programId })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Programma eliminato con successo', 'success');
                loadUserSettingsAndPrograms();
            } else {
                showToast(`Errore nell'eliminazione del programma: ${data.error || 'Errore sconosciuto'}`, 'error');
            }
        })
        .catch(error => {
            console.error('Errore di rete durante l\'eliminazione del programma:', error);
            showToast('Errore di rete durante l\'eliminazione del programma', 'error');
        });
    }
}

function editProgram(programId) {
    localStorage.setItem('editProgramId', programId);
    window.location.href = 'modify_program.html';
}

// Funzione per mostrare toast
function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        alert(message);
    }
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', initializeViewProgramsPage);