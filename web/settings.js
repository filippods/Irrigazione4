// Variabile per il polling dello stato della connessione
let connectionStatusInterval = null;
let isPollingActive = false;
let isFormDirty = false;  // Flag per tenere traccia delle modifiche non salvate

// Funzione per inizializzare la pagina delle impostazioni
function initializeSettingsPage(userData) {
    console.log("Inizializzazione pagina impostazioni con dati:", userData);
    
    // Se userData è vuoto o non definito, carica direttamente dal server
    if (!userData || Object.keys(userData).length === 0) {
        console.log("UserData non fornito, caricamento diretto dal server");
        fetch('/data/user_settings.json')
            .then(response => {
                if (!response.ok) throw new Error('Errore nel caricamento dei dati utente');
                return response.json();
            })
            .then(data => {
                console.log("Dati caricati dal server:", data);
                initializeSettingsWithData(data);
            })
            .catch(error => {
                console.error('Errore nel caricamento dei dati utente:', error);
                showToast('Errore nel caricamento delle impostazioni', 'error');
            });
    } else {
        initializeSettingsWithData(userData);
    }
}

// Funzione per inizializzare la pagina con i dati caricati
function initializeSettingsWithData(userData) {
    console.log("Inizializzazione impostazioni con dati:", userData);
    
    // Client WiFi
    document.getElementById('client-enabled').checked = userData.client_enabled || false;
    toggleWifiClientSettings(userData.client_enabled || false);
    
    // Impostazioni WiFi
    if (userData.wifi) {
        document.getElementById('wifi-list').value = userData.wifi.ssid || '';
        document.getElementById('wifi-password').value = userData.wifi.password || '';
    }
    
    // Impostazioni AP
    if (userData.ap) {
        document.getElementById('ap-ssid').value = userData.ap.ssid || '';
        document.getElementById('ap-password').value = userData.ap.password || '';
    }
    
    // Zone
    console.log("Zone disponibili:", userData.zones);
    initializeZoneSettings(userData.zones || []);
    
    // Impostazioni avanzate
    document.getElementById('max-active-zones').value = userData.max_active_zones || 1;
    document.getElementById('activation-delay').value = userData.activation_delay || 0;
    document.getElementById('max-zone-duration').value = userData.max_zone_duration || 180;
    
    if (userData.safety_relay) {
        document.getElementById('safety-relay-pin').value = userData.safety_relay.pin || '';
    }
    
    document.getElementById('automatic-programs-enabled').checked = userData.automatic_programs_enabled || false;
    
    // Aggiungi ascoltatori per rilevare modifiche ai campi
    addChangeListeners();
    
    // Debug
    console.log("Impostazioni inizializzate correttamente");
    
    // Mostra stato connessione
    fetchConnectionStatus();
}

// Funzione per rilevare modifiche ai campi
function addChangeListeners() {
    const inputs = document.querySelectorAll('input, select');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            isFormDirty = true;
        });
        
        if (input.type === 'text' || input.type === 'password' || input.type === 'number') {
            input.addEventListener('input', () => {
                isFormDirty = true;
            });
        }
    });
}

// Funzione per inizializzare le impostazioni delle zone
function initializeZoneSettings(zones = []) {
    console.log("initializeZoneSettings chiamato con zone:", zones);
    
    const zoneList = document.getElementById('zone-list');
    if (!zoneList) {
        console.error("Elemento 'zone-list' non trovato!");
        return;
    }
    
    zoneList.innerHTML = '';
    
    if (!Array.isArray(zones) || zones.length === 0) {
        zoneList.innerHTML = '<div class="no-zones">Nessuna zona configurata</div>';
        return;
    }
    
    zones.forEach(zone => {
        const zoneId = typeof zone.id !== 'undefined' ? zone.id : 0;
        const zoneName = zone.name || `Zona ${zoneId + 1}`;
        const zonePin = zone.pin || '';
        const zoneStatus = zone.status || 'show';
        
        console.log(`Rendering zona ${zoneId}: ${zoneName}, pin: ${zonePin}, status: ${zoneStatus}`);
        
        const zoneCard = document.createElement('div');
        zoneCard.className = 'zone-card';
        zoneCard.innerHTML = `
            <h4 style="text-align: center; font-weight: bold;">Zona ${zoneId + 1}</h4>
            <div class="input-group">
                <label>Nome:</label>
                <input type="text" value="${zoneName}" data-zone-id="${zoneId}" class="zone-name" maxlength="16">
            </div>
            <div class="input-group">
                <label>PIN:</label>
                <input type="number" value="${zonePin}" data-zone-id="${zoneId}" class="zone-pin">
            </div>
            <div class="input-group">
                <label>Stato:</label>
                <select data-zone-id="${zoneId}" class="zone-status">
                    <option value="show" ${zoneStatus === 'show' ? 'selected' : ''}>Mostra</option>
                    <option value="hide" ${zoneStatus === 'hide' ? 'selected' : ''}>Nascondi</option>
                </select>
            </div>
        `;
        zoneList.appendChild(zoneCard);
    });
    
    console.log(`Inizializzate ${zones.length} zone nella pagina impostazioni`);
}

// Funzione per confermare il salvataggio delle impostazioni
function confirmSaveSettings() {
    if (!isFormDirty) {
        showToast('Nessuna modifica da salvare', 'info');
        return;
    }
    
    if (confirm('Sei sicuro di voler salvare le modifiche? Potrebbero essere necessari alcuni secondi per applicare le nuove impostazioni.')) {
        showToast('Salvataggio in corso...', 'info');
        saveSettings();
    }
}

// Funzione per salvare le impostazioni
function saveSettings() {
    try {
        // Raccogli i dati dalle zone
        const zones = Array.from(document.querySelectorAll('.zone-card')).map(zoneCard => {
            const nameInput = zoneCard.querySelector('.zone-name');
            const pinInput = zoneCard.querySelector('.zone-pin');
            const statusSelect = zoneCard.querySelector('.zone-status');
            
            if (!nameInput || !pinInput || !statusSelect) {
                throw new Error('Errore nei campi della zona');
            }
            
            const name = nameInput.value.trim();
            if (name.length > 16) {
                throw new Error('Il nome della zona non può superare 16 caratteri');
            }
            
            return {
                id: parseInt(nameInput.getAttribute('data-zone-id')),
                pin: parseInt(pinInput.value),
                status: statusSelect.value,
                name: name
            };
        });
        
        // Raccogli le altre impostazioni
        const clientEnabled = document.getElementById('client-enabled').checked;
        const wifiSsid = document.getElementById('wifi-list').value;
        const wifiPassword = document.getElementById('wifi-password').value;
        const apSsid = document.getElementById('ap-ssid').value;
        const apPassword = document.getElementById('ap-password').value;
        const maxActiveZones = parseInt(document.getElementById('max-active-zones').value);
        const activationDelay = parseInt(document.getElementById('activation-delay').value);
        const maxZoneDuration = parseInt(document.getElementById('max-zone-duration').value);
        const safetyRelayPin = parseInt(document.getElementById('safety-relay-pin').value);
        const automaticProgramsEnabled = document.getElementById('automatic-programs-enabled').checked;
        
        // Validazione
        if (apSsid.length < 1) {
            throw new Error('Il nome (SSID) dell\'Access Point non può essere vuoto');
        }
        
        if (apPassword.length < 8) {
            throw new Error('La password dell\'Access Point deve essere di almeno 8 caratteri');
        }
        
        if (clientEnabled && (!wifiSsid || !wifiPassword)) {
            throw new Error('Inserisci SSID e password per attivare la modalità client WiFi');
        }
        
        // Costruisci l'oggetto delle impostazioni
        const settings = {
            client_enabled: clientEnabled,
            wifi: {
                ssid: wifiSsid,
                password: wifiPassword
            },
            ap: {
                ssid: apSsid,
                password: apPassword
            },
            zones: zones,
            max_active_zones: maxActiveZones,
            activation_delay: activationDelay,
            max_zone_duration: maxZoneDuration,
            safety_relay: {
                pin: safetyRelayPin
            },
            automatic_programs_enabled: automaticProgramsEnabled
        };
        
        // Invia le impostazioni al server
        fetch('/save_user_settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showToast('Impostazioni salvate con successo!', 'success');
                isFormDirty = false;
                
                // Ricarica i dati utente nella variabile globale
                fetch('/data/user_settings.json')
                    .then(response => response.json())
                    .then(data => {
                        window.userData = data;
                    });
                
                // Aggiorna lo stato della connessione
                setTimeout(fetchConnectionStatus, 2000);
            } else {
                showToast('Errore durante il salvataggio: ' + (data.error || 'Errore sconosciuto'), 'error');
            }
        })
        .catch(error => {
            console.error('Errore durante il salvataggio:', error);
            showToast('Errore di rete durante il salvataggio', 'error');
        });
        
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Polling dello stato della connessione
function startConnectionStatusPolling() {
    if (isPollingActive) return;
    
    isPollingActive = true;
    
    if (connectionStatusInterval) {
        clearInterval(connectionStatusInterval);
    }
    
    // Prima chiamata immediata
    fetchConnectionStatus();
    
    // Poi ogni 10 secondi
    connectionStatusInterval = setInterval(fetchConnectionStatus, 10000);
}

function stopConnectionStatusPolling() {
    if (connectionStatusInterval) {
        clearInterval(connectionStatusInterval);
        connectionStatusInterval = null;
    }
    
    isPollingActive = false;
}

// Mostra/Nascondi impostazioni WiFi client
function toggleWifiClientSettings(enable) {
    const wifiSettings = document.getElementById('wifi-settings');
    if (wifiSettings) {
        wifiSettings.style.display = enable ? 'block' : 'none';
    }
}

// Funzione per scansionare le reti WiFi
function scanWifiNetworks() {
    const scanButton = document.getElementById('scan-wifi-button');
    if (scanButton) {
        scanButton.disabled = true;
        scanButton.textContent = 'Scansione in corso...';
    }
    
    showToast('Scansione reti WiFi in corso...', 'info');
    
    fetch('/scan_wifi')
        .then(response => {
            if (!response.ok) throw new Error('Errore nella scansione');
            return response.json();
        })
        .then(networks => {
            updateWifiList(networks);
            showToast('Scansione completata!', 'success');
        })
        .catch(error => {
            console.error('Errore:', error);
            showToast('Errore durante la scansione', 'error');
        })
        .finally(() => {
            if (scanButton) {
                scanButton.disabled = false;
                scanButton.textContent = 'Scansiona Reti';
            }
        });
}

// Aggiorna la lista delle reti WiFi
function updateWifiList(networks) {
    const wifiSelect = document.getElementById('wifi-list');
    if (!wifiSelect) return;
    
    wifiSelect.innerHTML = '';
    
    if (networks.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Nessuna rete trovata';
        wifiSelect.appendChild(option);
        return;
    }
    
    networks.forEach(network => {
        const option = document.createElement('option');
        option.value = network.ssid;
        option.textContent = `${network.ssid} (${network.signal})`;
        wifiSelect.appendChild(option);
    });
}

// Recupera lo stato della connessione
function fetchConnectionStatus() {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;
    
    statusElement.innerHTML = '<p style="text-align:center">Caricamento stato connessione...</p>';
    statusElement.style.display = 'block';
    
    fetch('/get_connection_status')
        .then(response => {
            if (!response.ok) throw new Error('Errore nel recupero dello stato');
            return response.json();
        })
        .then(data => {
            updateConnectionStatus(data);
        })
        .catch(error => {
            console.error('Errore:', error);
            statusElement.innerHTML = '<p style="text-align:center;color:#ff3333">Errore nel recupero dello stato della connessione</p>';
        });
}

// Aggiorna l'interfaccia con lo stato della connessione
function updateConnectionStatus(status) {
    const statusElement = document.getElementById('connection-status');
    if (!statusElement) return;
    
    let statusHTML = '';
    
    if (status.mode === 'client') {
        statusHTML = `
            <div style="padding:10px;background-color:#e0ffe0;border-radius:6px;margin-top:10px">
                <h4 style="margin-top:0;color:#00cc66">Connesso come Client WiFi</h4>
                <p><strong>SSID:</strong> ${status.ssid}</p>
                <p><strong>Indirizzo IP:</strong> ${status.ip}</p>
            </div>
        `;
    } else if (status.mode === 'AP') {
        statusHTML = `
            <div style="padding:10px;background-color:#e0f0ff;border-radius:6px;margin-top:10px">
                <h4 style="margin-top:0;color:#0099ff">Modalità Access Point attiva</h4>
                <p><strong>SSID:</strong> ${status.ssid}</p>
                <p><strong>Indirizzo IP:</strong> ${status.ip}</p>
            </div>
        `;
    } else {
        statusHTML = `
            <div style="padding:10px;background-color:#fff0e0;border-radius:6px;margin-top:10px">
                <h4 style="margin-top:0;color:#ff9900">Nessuna connessione attiva</h4>
            </div>
        `;
    }
    
    statusElement.innerHTML = statusHTML;
    statusElement.style.display = 'block';
}

// Funzione per connettersi alla rete WiFi
function connectToSelectedWifi() {
    const ssid = document.getElementById('wifi-list').value;
    const password = document.getElementById('wifi-password').value;
    
    if (!ssid) {
        showToast('Seleziona una rete WiFi', 'warning');
        return;
    }
    
    if (!password) {
        showToast('Inserisci la password della rete WiFi', 'warning');
        return;
    }
    
    showToast('Tentativo di connessione in corso...', 'info');
    
    fetch('/connect_wifi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid, password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast(`Connesso alla rete WiFi con IP: ${data.ip}`, 'success');
            
            // Attiva automaticamente il client
            document.getElementById('client-enabled').checked = true;
            
            // Aggiorna lo stato
            setTimeout(fetchConnectionStatus, 2000);
        } else {
            showToast('Errore durante la connessione: ' + (data.error || 'Errore sconosciuto'), 'error');
        }
    })
    .catch(error => {
        console.error('Errore:', error);
        showToast('Errore di rete durante la connessione', 'error');
    });
}

// Funzione per confermare il riavvio del sistema
function confirmRestartSystem() {
    if (confirm('Sei sicuro di voler riavviare il sistema? Tutte le zone attive verranno disattivate.')) {
        showToast('Riavvio in corso...', 'info');
        restartSystem();
    }
}

// Funzione per riavviare il sistema
function restartSystem() {
    fetch('/restart_system', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('Sistema in riavvio. La pagina si ricaricherà tra 30 secondi...', 'info');
            setTimeout(() => {
                window.location.reload();
            }, 30000);
        } else {
            showToast('Errore durante il riavvio: ' + (data.error || 'Errore sconosciuto'), 'error');
        }
    })
    .catch(error => {
        console.error('Errore:', error);
        showToast('Errore di rete durante il riavvio', 'error');
    });
}

// Funzione per confermare il reset delle impostazioni
function confirmResetSettings() {
    if (confirm('Sei sicuro di voler resettare tutte le impostazioni? Questa operazione non può essere annullata.')) {
        showToast('Reset delle impostazioni in corso...', 'info');
        resetSettings();
    }
}

// Funzione per resettare le impostazioni
function resetSettings() {
    fetch('/reset_settings', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('Impostazioni resettate. La pagina si ricaricherà...', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } else {
            showToast('Errore durante il reset: ' + (data.error || 'Errore sconosciuto'), 'error');
        }
    })
    .catch(error => {
        console.error('Errore:', error);
        showToast('Errore di rete durante il reset', 'error');
    });
}

// Funzione per confermare il reset dei dati di fabbrica
function confirmResetFactoryData() {
    if (confirm('ATTENZIONE: Questa operazione cancellerà tutti i programmi e resetterà tutte le impostazioni. Continuare?')) {
        showToast('Reset dati di fabbrica in corso...', 'info');
        resetFactoryData();
    }
}

// Funzione per resettare i dati di fabbrica
function resetFactoryData() {
    fetch('/reset_factory_data', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('Dati di fabbrica resettati. La pagina si ricaricherà...', 'success');
            setTimeout(() => {
                window.location.reload();
            }, 3000);
        } else {
            showToast('Errore durante il reset: ' + (data.error || 'Errore sconosciuto'), 'error');
        }
    })
    .catch(error => {
        console.error('Errore:', error);
        showToast('Errore di rete durante il reset', 'error');
    });
}

// Funzione per mostrare toast
function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        alert(message);
    }
}

// Listener per inizializzazione pagina
document.addEventListener('DOMContentLoaded', () => {
    const clientEnabledCheckbox = document.getElementById('client-enabled');
    if (clientEnabledCheckbox) {
        clientEnabledCheckbox.addEventListener('change', e => {
            toggleWifiClientSettings(e.target.checked);
        });
    }
    
    // Avvia il polling
    startConnectionStatusPolling();
    
    // Pulisci il polling quando si lascia la pagina
    window.addEventListener('beforeunload', () => {
        stopConnectionStatusPolling();
    });
});