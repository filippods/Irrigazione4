// create_program.js - Script per la pagina di creazione programmi

// Variabili globali
let editingProgramId = null;
let userZones = [];
const months = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 
    'Maggio', 'Giugno', 'Luglio', 'Agosto', 
    'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

// Inizializza la pagina di creazione programma
function initializeCreateProgramPage() {
    console.log("Inizializzazione pagina creazione programma");
    
    // IMPORTANTE: Pulisci qualsiasi valore precedente di editProgramId
    // Solo se stiamo nella pagina di creazione e non di modifica
    const currentPath = window.location.pathname;
    if (currentPath.endsWith('create_program.html')) {
        // Se siamo nella pagina di creazione, assicuriamoci che non ci sia un ID di modifica
        if (localStorage.getItem('editProgramId')) {
            console.log("Ripulito editProgramId dalla localStorage nella pagina di creazione");
            localStorage.removeItem('editProgramId');
        }
    }
    
    // Verifica se stiamo modificando un programma esistente
    editingProgramId = localStorage.getItem('editProgramId');
    
    // Carica i dati utente per ottenere le zone
    loadUserSettings()
        .then(userSettings => {
            // Genera la griglia dei mesi
            generateMonthsGrid();
            
            // Genera la griglia delle zone
            generateZonesGrid(userSettings.zones);
            
            // Se stiamo modificando un programma esistente, carica i suoi dati
            if (editingProgramId) {
                loadProgramData(editingProgramId);
                
                // Cambia il titolo della pagina
                document.querySelector('.page-title').textContent = 'Modifica Programma';
                
                // Cambia il testo del pulsante
                document.getElementById('save-button').textContent = 'Aggiorna Programma';
            }
        })
        .catch(error => {
            console.error('Errore nel caricamento delle impostazioni:', error);
            showToast('Errore nel caricamento delle impostazioni', 'error');
        });
}

// Carica le impostazioni utente
function loadUserSettings() {
    return new Promise((resolve, reject) => {
        fetch('/data/user_settings.json')
            .then(response => {
                if (!response.ok) throw new Error('Errore nel caricamento delle impostazioni utente');
                return response.json();
            })
            .then(userSettings => {
                // Filtra solo le zone visibili
                if (userSettings.zones && Array.isArray(userSettings.zones)) {
                    userZones = userSettings.zones.filter(zone => zone && zone.status === 'show');
                } else {
                    userZones = [];
                }
                resolve(userSettings);
            })
            .catch(error => {
                console.error('Errore:', error);
                reject(error);
            });
    });
}

// Genera la griglia dei mesi
function generateMonthsGrid() {
    const monthsGrid = document.getElementById('months-grid');
    if (!monthsGrid) return;
    
    monthsGrid.innerHTML = '';
    
    months.forEach(month => {
        const monthItem = document.createElement('div');
        monthItem.className = 'month-item';
        monthItem.textContent = month;
        monthItem.dataset.month = month;
        
        monthItem.addEventListener('click', () => {
            monthItem.classList.toggle('selected');
        });
        
        monthsGrid.appendChild(monthItem);
    });
}

// Genera la griglia delle zone
function generateZonesGrid(zones) {
    const zonesGrid = document.getElementById('zones-grid');
    if (!zonesGrid) return;
    
    zonesGrid.innerHTML = '';
    
    // Filtra solo le zone visibili
    const visibleZones = zones && Array.isArray(zones) ? 
                        zones.filter(zone => zone && zone.status === 'show') : [];
    
    if (visibleZones.length === 0) {
        zonesGrid.innerHTML = `
            <div style="grid-column: 1/-1; text-align:center; padding:20px;">
                <p>Nessuna zona disponibile.</p>
                <button onclick="loadPage('settings.html')" class="button secondary-button">
                    Configura Zone
                </button>
            </div>
        `;
        return;
    }
    
    visibleZones.forEach(zone => {
        if (!zone || zone.id === undefined) return;
        
        const zoneItem = document.createElement('div');
        zoneItem.className = 'zone-item';
        zoneItem.dataset.zoneId = zone.id;
        
        zoneItem.innerHTML = `
            <div class="zone-header">
                <input type="checkbox" class="zone-checkbox" id="zone-${zone.id}" data-zone-id="${zone.id}">
                <label for="zone-${zone.id}" class="zone-name">${zone.name || `Zona ${zone.id + 1}`}</label>
            </div>
            <div>
                <input type="number" class="zone-duration" id="duration-${zone.id}" 
                       min="1" max="180" value="10" placeholder="Durata (minuti)" 
                       data-zone-id="${zone.id}" disabled>
            </div>
        `;
        
        zonesGrid.appendChild(zoneItem);
        
        // Aggiungi listener al checkbox
        const checkbox = zoneItem.querySelector('.zone-checkbox');
        const durationInput = zoneItem.querySelector('.zone-duration');
        
        checkbox.addEventListener('change', () => {
            // Abilita/disabilita l'input durata in base allo stato del checkbox
            durationInput.disabled = !checkbox.checked;
            
            // Aggiorna la classe selected della zona
            zoneItem.classList.toggle('selected', checkbox.checked);
            
            // Se il checkbox è selezionato, imposta il focus sull'input durata
            if (checkbox.checked) {
                durationInput.focus();
            }
        });
    });
}

// Mostra/nascondi l'input per i giorni personalizzati
function toggleCustomDays() {
    const recurrenceSelect = document.getElementById('recurrence');
    const customDaysDiv = document.getElementById('custom-days');
    
    if (recurrenceSelect && customDaysDiv) {
        if (recurrenceSelect.value === 'personalizzata') {
            customDaysDiv.classList.add('visible');
        } else {
            customDaysDiv.classList.remove('visible');
        }
    }
}

// Carica i dati di un programma esistente per la modifica
function loadProgramData(programId) {
    fetch('/data/program.json')
        .then(response => {
            if (!response.ok) throw new Error('Errore nel caricamento dei programmi');
            return response.json();
        })
        .then(programs => {
            if (!programs || typeof programs !== 'object') {
                throw new Error('Formato programmi non valido');
            }
            
            const program = programs[programId];
            if (!program) {
                throw new Error('Programma non trovato');
            }
            
            // Compila il form con i dati del programma
            document.getElementById('program-name').value = program.name || '';
            document.getElementById('activation-time').value = program.activation_time || '';
            document.getElementById('recurrence').value = program.recurrence || 'giornaliero';
            
            // Se la ricorrenza è personalizzata, mostra e imposta l'intervallo
            if (program.recurrence === 'personalizzata') {
                toggleCustomDays();
                document.getElementById('interval-days').value = program.interval_days || 3;
            }
            
            // Seleziona i mesi
            if (program.months && program.months.length > 0) {
                const monthItems = document.querySelectorAll('.month-item');
                monthItems.forEach(item => {
                    if (program.months.includes(item.dataset.month)) {
                        item.classList.add('selected');
                    }
                });
            }
            
            // Seleziona le zone e imposta le durate
            if (program.steps && program.steps.length > 0) {
                program.steps.forEach(step => {
                    if (!step || step.zone_id === undefined) return;
                    
                    const checkbox = document.getElementById(`zone-${step.zone_id}`);
                    const durationInput = document.getElementById(`duration-${step.zone_id}`);
                    
                    if (checkbox && durationInput) {
                        checkbox.checked = true;
                        durationInput.disabled = false;
                        durationInput.value = step.duration || 10;
                        
                        // Seleziona anche la card della zona
                        const zoneItem = document.querySelector(`.zone-item[data-zone-id="${step.zone_id}"]`);
                        if (zoneItem) {
                            zoneItem.classList.add('selected');
                        }
                    }
                });
            }
        })
        .catch(error => {
            console.error('Errore nel caricamento del programma:', error);
            showToast(`Errore: ${error.message}`, 'error');
        });
}

// Salva il programma
function saveProgram() {
    // Disabilita il pulsante durante il salvataggio
    const saveButton = document.getElementById('save-button');
    saveButton.classList.add('loading');
    saveButton.disabled = true;
    
    // Raccogli i dati dal form
    const programName = document.getElementById('program-name').value.trim();
    const activationTime = document.getElementById('activation-time').value;
    const recurrence = document.getElementById('recurrence').value;
    let intervalDays = null;
    
    if (recurrence === 'personalizzata') {
        intervalDays = parseInt(document.getElementById('interval-days').value);
        if (isNaN(intervalDays) || intervalDays < 1) {
            showToast('Inserisci un intervallo di giorni valido', 'error');
            saveButton.classList.remove('loading');
            saveButton.disabled = false;
            return;
        }
    }
    
    // Valida il nome del programma
    if (!programName) {
        showToast('Inserisci un nome per il programma', 'error');
        saveButton.classList.remove('loading');
        saveButton.disabled = false;
        return;
    }
    
    // Valida l'orario di attivazione
    if (!activationTime) {
        showToast('Seleziona un orario di attivazione', 'error');
        saveButton.classList.remove('loading');
        saveButton.disabled = false;
        return;
    }
    
    // Raccogli i mesi selezionati
    const selectedMonths = [];
    document.querySelectorAll('.month-item.selected').forEach(item => {
        selectedMonths.push(item.dataset.month);
    });
    
    if (selectedMonths.length === 0) {
        showToast('Seleziona almeno un mese', 'error');
        saveButton.classList.remove('loading');
        saveButton.disabled = false;
        return;
    }
    
    // Raccogli le zone selezionate e le loro durate
    const steps = [];
    document.querySelectorAll('.zone-checkbox:checked').forEach(checkbox => {
        const zoneId = parseInt(checkbox.dataset.zoneId);
        const durationInput = document.getElementById(`duration-${zoneId}`);
        const duration = parseInt(durationInput.value);
        
        if (isNaN(duration) || duration < 1) {
            showToast(`Durata non valida per la zona ${userZones.find(z => z.id === zoneId)?.name || `Zona ${zoneId + 1}`}`, 'error');
            saveButton.classList.remove('loading');
            saveButton.disabled = false;
            return;
        }
        
        steps.push({
            zone_id: zoneId,
            duration: duration
        });
    });
    
    if (steps.length === 0) {
        showToast('Seleziona almeno una zona', 'error');
        saveButton.classList.remove('loading');
        saveButton.disabled = false;
        return;
    }
    
    // Crea l'oggetto programma
    const program = {
        name: programName,
        activation_time: activationTime,
        recurrence: recurrence,
        months: selectedMonths,
        steps: steps
    };
    
    // Aggiungi l'intervallo dei giorni se la ricorrenza è personalizzata
    if (recurrence === 'personalizzata') {
        program.interval_days = intervalDays;
    }
    
    // Se stiamo modificando un programma esistente, aggiungi l'ID
    if (editingProgramId) {
        program.id = editingProgramId;
    }
    
    // Determina l'endpoint e il metodo in base all'operazione
    const endpoint = editingProgramId ? '/update_program' : '/save_program';
    const method = editingProgramId ? 'PUT' : 'POST';
    
    // Invia la richiesta al server
    fetch(endpoint, {
        method: method,
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(program)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Errore HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            showToast(`Programma ${editingProgramId ? 'aggiornato' : 'salvato'} con successo`, 'success');
            
            // Pulisci il localStorage se stavamo modificando un programma
            if (editingProgramId) {
                localStorage.removeItem('editProgramId');
            }
            
            // Torna alla pagina dei programmi dopo un breve ritardo
            setTimeout(() => {
                loadPage('view_programs.html');
            }, 1000);
        } else {
            throw new Error(data.error || 'Errore durante il salvataggio');
        }
    })
    .catch(error => {
        console.error('Errore:', error);
        showToast(`Errore: ${error.message}`, 'error');
        
        // Riabilita il pulsante
        saveButton.classList.remove('loading');
        saveButton.disabled = false;
    });
}

// Torna alla pagina precedente
function goBack() {
    // Pulisci il localStorage se stavamo modificando un programma
    if (editingProgramId) {
        localStorage.removeItem('editProgramId');
    }
    
    // Torna alla pagina dei programmi
    loadPage('view_programs.html');
}

// Inizializzazione quando il documento è caricato
document.addEventListener('DOMContentLoaded', initializeCreateProgramPage);