// Variabili
let maxActiveZones = 1;
let progressIntervals = {};
let userSettings = {};

// Inizializza la pagina manuale
function initializeManualPage(userData) {
    console.log("Inizializzazione pagina manuale");
    
    if (userData) {
        userSettings = userData;
        // Carica maxActiveZones dalle impostazioni utente
        maxActiveZones = userData.max_active_zones || 1;
    } else {
        // Se userData non è disponibile, carica le impostazioni dal server
        fetch('/data/user_settings.json')
            .then(response => response.json())
            .then(data => {
                userSettings = data;
                maxActiveZones = data.max_active_zones || 1;
                renderZones(data.zones || []);
            })
            .catch(error => {
                console.error('Errore nel caricamento delle impostazioni:', error);
                showToast('Errore nel caricamento delle impostazioni', 'error');
            });
    }
    
    // Se userData è disponibile, procedi con il rendering
    if (userData && userData.zones) {
        renderZones(userData.zones);
    }
    
    // Aggiungi event listener per aggiornare periodicamente lo stato delle zone
    const intervalId = setInterval(fetchZonesStatus, 3000);
    
    // Memorizza l'ID dell'intervallo per poterlo pulire quando si lascia la pagina
    window.manualPageInterval = intervalId;
    
    // Esegui subito la prima volta
    fetchZonesStatus();
}

// Pulisci quando si cambia pagina
function cleanupManualPage() {
    if (window.manualPageInterval) {
        clearInterval(window.manualPageInterval);
    }
    
    // Pulisci gli intervalli di progresso
    for (const id in progressIntervals) {
        if (progressIntervals[id]) {
            clearInterval(progressIntervals[id]);
        }
    }
}

// Renderizza le zone
function renderZones(zones) {
    console.log("Rendering zone:", zones);
    
    const container = document.getElementById('zone-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    zones.forEach(zone => {
        if (zone.status === "show") {
            const zoneCard = document.createElement('div');
            zoneCard.className = 'zone-card';
            zoneCard.id = `zone-${zone.id}`;
            zoneCard.innerHTML = `
                <h3>${zone.name || `Zona ${zone.id + 1}`}</h3>
                <div class="input-container">
                    <input type="number" id="duration-${zone.id}" placeholder="Durata (minuti)" max="300" min="1" value="10">
                    <div class="toggle-switch">
                        <label class="switch">
                            <input type="checkbox" id="toggle-${zone.id}" class="zone-toggle" data-zone-id="${zone.id}">
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
                <div class="progress-wrapper">
                    <progress id="progress-${zone.id}" value="0" max="100"></progress>
                    <div class="progress-timer" id="timer-${zone.id}">00:00</div>
                </div>
            `;
            container.appendChild(zoneCard);
        }
    });
    
    // Aggiungi i listener dopo aver creato gli elementi
    attachZoneToggleFunctions();
}

// Recupera lo stato delle zone dal server
function fetchZonesStatus() {
    fetch('/get_zones_status')
        .then(response => {
            if (!response.ok) throw new Error('Errore nel recupero dello stato delle zone');
            return response.json();
        })
        .then(zonesStatus => {
            console.log("Stato zone ricevuto:", zonesStatus);
            updateZonesUI(zonesStatus);
        })
        .catch(error => {
            console.error('Errore nel recupero dello stato delle zone:', error);
        });
}

// Aggiorna l'interfaccia in base allo stato delle zone
function updateZonesUI(zonesStatus) {
    if (!Array.isArray(zonesStatus)) return;
    
    zonesStatus.forEach(zone => {
        const toggle = document.getElementById(`toggle-${zone.id}`);
        const zoneCard = document.getElementById(`zone-${zone.id}`);
        
        if (!toggle || !zoneCard) return;
        
        // Aggiorna lo stato del toggle senza innescare l'evento change
        const isCurrentlyChecked = toggle.checked;
        if (isCurrentlyChecked !== zone.active) {
            // Rimuovi temporaneamente l'event listener
            const originalOnChange = toggle.onchange;
            toggle.onchange = null;
            
            // Cambia lo stato
            toggle.checked = zone.active;
            
            // Ripristina l'event listener
            setTimeout(() => {
                toggle.onchange = originalOnChange;
            }, 0);
        }
        
        // Aggiorna la classe visiva della card
        if (zone.active) {
            zoneCard.classList.add('active');
        } else {
            zoneCard.classList.remove('active');
        }
        
        // Aggiorna la barra di progresso se la zona è attiva
        if (zone.active) {
            const progressBar = document.getElementById(`progress-${zone.id}`);
            const timerDisplay = document.getElementById(`timer-${zone.id}`);
            
            if (progressBar && timerDisplay) {
                // Se non c'è già un intervallo in corso per questa zona, creane uno
                if (!progressIntervals[zone.id]) {
                    // Trova la durata totale in secondi
                    const duration = findZoneDuration(zone.id) * 60; // minuti a secondi
                    if (duration > 0) {
                        const remainingTime = zone.remaining_time;
                        const elapsedTime = duration - remainingTime;
                        updateProgressBar(zone.id, elapsedTime, duration, remainingTime);
                    }
                }
            }
        } else {
            // Se la zona non è attiva ma c'è un intervallo in corso, fermalo
            if (progressIntervals[zone.id]) {
                clearInterval(progressIntervals[zone.id]);
                delete progressIntervals[zone.id];
                
                // Resetta la barra di progresso
                const progressBar = document.getElementById(`progress-${zone.id}`);
                const timerDisplay = document.getElementById(`timer-${zone.id}`);
                
                if (progressBar && timerDisplay) {
                    progressBar.value = 0;
                    timerDisplay.textContent = '00:00';
                }
            }
        }
    });
}

// Trova la durata impostata per una zona
function findZoneDuration(zoneId) {
    const durationInput = document.getElementById(`duration-${zoneId}`);
    if (durationInput) {
        const duration = parseInt(durationInput.value);
        return isNaN(duration) ? 0 : duration;
    }
    return 0;
}

// Aggiorna la barra di progresso
function updateProgressBar(zoneId, elapsedTime, totalTime, remainingTime) {
    const progressBar = document.getElementById(`progress-${zoneId}`);
    const timerDisplay = document.getElementById(`timer-${zoneId}`);
    
    if (!progressBar || !timerDisplay) return;
    
    // Imposta il valore iniziale
    progressBar.value = (elapsedTime / totalTime) * 100;
    updateTimerDisplay(remainingTime, timerDisplay);
    
    // Cancella l'intervallo esistente se presente
    if (progressIntervals[zoneId]) {
        clearInterval(progressIntervals[zoneId]);
    }
    
    // Crea un nuovo intervallo
    progressIntervals[zoneId] = setInterval(() => {
        elapsedTime++;
        remainingTime--;
        
        if (remainingTime <= 0) {
            clearInterval(progressIntervals[zoneId]);
            delete progressIntervals[zoneId];
            progressBar.value = 0;
            timerDisplay.textContent = '00:00';
            
            // Aggiorna lo stato del toggle
            const toggle = document.getElementById(`toggle-${zoneId}`);
            if (toggle) toggle.checked = false;
            
            // Aggiorna la classe visiva della card
            const zoneCard = document.getElementById(`zone-${zoneId}`);
            if (zoneCard) zoneCard.classList.remove('active');
            
            return;
        }
        
        progressBar.value = (elapsedTime / totalTime) * 100;
        updateTimerDisplay(remainingTime, timerDisplay);
    }, 1000);
}

// Aggiorna il display del timer
function updateTimerDisplay(timeInSeconds, displayElement) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    displayElement.textContent = formattedTime;
}

// Funzione per avviare una zona
function startZone(zoneId, duration) {
    console.log(`Tentativo di avvio zona ${zoneId} per ${duration} minuti`);
    
    // Verifica se abbiamo già raggiunto il numero massimo di zone attive
    const activeToggles = document.querySelectorAll('.zone-toggle:checked');
    
    console.log(`Zone attive: ${activeToggles.length}, Massimo consentito: ${maxActiveZones}`);
    
    if (activeToggles.length >= maxActiveZones) {
        const thisToggle = document.getElementById(`toggle-${zoneId}`);
        
        // Se questa zona è già attiva, lasciala attiva
        if (thisToggle && !thisToggle.checked) {
            showToast(`Impossibile attivare più di ${maxActiveZones} zone contemporaneamente`, 'error');
            thisToggle.checked = false;
            return;
        }
    }
    
    // Disabilita il toggle durante la richiesta
    const toggle = document.getElementById(`toggle-${zoneId}`);
    if (toggle) toggle.disabled = true;
    
    // Aggiungi classe loading
    const progressBar = document.getElementById(`progress-${zoneId}`);
    if (progressBar) progressBar.classList.add('loading');

    fetch('/start_zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId, duration: duration })
    })
    .then(response => {
        // Riabilita il toggle
        if (toggle) toggle.disabled = false;
        if (progressBar) progressBar.classList.remove('loading');
        
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log("Risposta dal server:", data);
        
        if (data.error) {
            console.error('Errore durante l\'avvio della zona:', data.error);
            // Mostra errore all'utente
            showToast('Errore: ' + data.error, 'error');
            // Riporta il toggle allo stato OFF
            if (toggle) toggle.checked = false;
        } else {
            console.log(`Zona ${zoneId} avviata per ${duration} minuti.`);
            showToast(`Zona ${zoneId} avviata per ${duration} minuti`, 'success');
            
            // Aggiungi classe di zona attiva
            const zoneCard = document.getElementById(`zone-${zoneId}`);
            if (zoneCard) zoneCard.classList.add('active');
        }
        
        // Aggiorna immediatamente lo stato delle zone
        fetchZonesStatus();
    })
    .catch(error => {
        console.error('Errore durante l\'avvio della zona:', error);
        showToast(`Errore: ${error.message}`, 'error');
        // Riporta il toggle allo stato OFF
        if (toggle) toggle.checked = false;
        if (progressBar) progressBar.classList.remove('loading');
    });
}

// Funzione per fermare una zona
function stopZone(zoneId) {
    // Disabilita il toggle durante la richiesta
    const toggle = document.getElementById(`toggle-${zoneId}`);
    if (toggle) toggle.disabled = true;
    
    fetch('/stop_zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zone_id: zoneId })
    })
    .then(response => {
        // Riabilita il toggle
        if (toggle) toggle.disabled = false;
        
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.error) {
            console.error('Errore durante l\'arresto della zona:', data.error);
            showToast('Errore: ' + data.error, 'error');
            // Mantieni lo stato attuale
            if (toggle) toggle.checked = true;
        } else {
            console.log(`Zona ${zoneId} arrestata.`);
            showToast(`Zona ${zoneId} arrestata`, 'info');
            
            // Rimuovi classe di zona attiva
            const zoneCard = document.getElementById(`zone-${zoneId}`);
            if (zoneCard) zoneCard.classList.remove('active');
            
            // Resetta la barra di progresso
            if (progressIntervals[zoneId]) {
                clearInterval(progressIntervals[zoneId]);
                delete progressIntervals[zoneId];
                
                const progressBar = document.getElementById(`progress-${zoneId}`);
                const timerDisplay = document.getElementById(`timer-${zoneId}`);
                
                if (progressBar && timerDisplay) {
                    progressBar.value = 0;
                    timerDisplay.textContent = '00:00';
                }
            }
        }
        
        // Aggiorna lo stato delle zone
        fetchZonesStatus();
    })
    .catch(error => {
        console.error('Errore durante l\'arresto della zona:', error);
        showToast(`Errore: ${error.message}`, 'error');
        // Ripristina lo stato precedente
        if (toggle) toggle.disabled = false;
    });
}

// Aggiungi i listener agli elementi toggle
function attachZoneToggleFunctions() {
    const zoneToggles = document.querySelectorAll('.zone-toggle');
    console.log('Number of zone toggles found:', zoneToggles.length);
    
    zoneToggles.forEach(toggle => {
        toggle.addEventListener('change', event => {
            console.log('Toggle changed:', event.target);
            const zoneId = parseInt(event.target.getAttribute('data-zone-id'));
            const isChecked = event.target.checked;
            
            if (isChecked) {
                // Avvia la zona
                const durationInput = document.getElementById(`duration-${zoneId}`);
                const duration = parseInt(durationInput.value);
                
                if (isNaN(duration) || duration <= 0) {
                    showToast('Inserisci una durata valida in minuti', 'warning');
                    event.target.checked = false;
                    return;
                }
                
                startZone(zoneId, duration);
            } else {
                // Ferma la zona
                stopZone(zoneId);
            }
        });
    });
}

// Funzione per mostrare notifiche toast
function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        alert(message);
    }
}

// Inizializzazione quando il documento è caricato
document.addEventListener('DOMContentLoaded', () => {
    // Se userSettings è già disponibile, inizializza la pagina
    if (Object.keys(window.userData || {}).length > 0) {
        initializeManualPage(window.userData);
    }
    
    // Pulizia quando l'utente lascia la pagina
    window.addEventListener('beforeunload', cleanupManualPage);
});