function initializeModifyProgramPage() {
    console.log("Inizializzazione pagina modifica programma");
    let editingProgram = null;  // Variabile locale
    
    // Ottieni l'ID del programma da modificare
    const programId = localStorage.getItem('editProgramId');
    if (!programId) {
        showToast('Nessun programma selezionato', 'error');
        window.location.href = 'main.html';
        return;
    }
    
    console.log("Caricamento programma con ID:", programId);
    
    fetch('/data/user_settings.json')
        .then(response => response.json())
        .then(userData => {
            console.log("Dati utente caricati:", userData);
            const zones = userData.zones;
            
            // Inizializza i selettori di mesi e zone
            initializeSelectorsWithZones(zones);
            
            // Carica il programma
            loadProgramForEditing(programId);
        })
        .catch(error => {
            console.error('Errore nel caricamento dei dati utente:', error);
            showToast('Errore nel caricamento dei dati', 'error');
        });
}

function initializeSelectorsWithZones(zones) {
    const monthsContainer = document.getElementById('months-list');
    const zoneContainer = document.getElementById('zone-list');
    
    if (!monthsContainer || !zoneContainer) {
        console.error("Contenitori per mesi o zone non trovati");
        return;
    }
    
    // Pulisci i contenitori
    monthsContainer.innerHTML = '';
    zoneContainer.innerHTML = '';

    // Inizializza i selettori di mese
    const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
    months.forEach(month => {
        const monthItem = document.createElement('div');
        monthItem.className = 'month-item';
        monthItem.textContent = month;
        monthItem.addEventListener('click', () => {
            monthItem.classList.toggle('selected');
        });
        monthsContainer.appendChild(monthItem);
    });

    // Inizializza i selettori di zone
    if (Array.isArray(zones)) {
        zones.forEach(zone => {
            if (zone.status === "show") {
                const zoneItem = document.createElement('div');
                zoneItem.className = 'zone-item';
                zoneItem.innerHTML = `
                    <span>${zone.name || `Zona ${zone.id + 1}`}</span>
                    <input type="number" class="zone-duration" placeholder="Durata (min)" data-zone-id="${zone.id}" min="1">
                `;
                zoneItem.addEventListener('click', () => {
                    zoneItem.classList.toggle('selected');
                });
                zoneContainer.appendChild(zoneItem);
            }
        });
    } else {
        console.error("Zone non disponibili o non valide:", zones);
    }
}

function loadProgramForEditing(programId) {
    console.log("Caricamento programma per modifica:", programId);
    
    fetch('/data/program.json')
        .then(response => {
            if (!response.ok) throw new Error('Errore nel caricamento dei programmi');
            return response.json();
        })
        .then(programs => {
            console.log("Programmi caricati:", programs);
            const program = programs[programId];
            
            if (!program) {
                showToast('Programma non trovato', 'error');
                window.location.href = 'main.html';
                return;
            }
            
            console.log("Programma da modificare:", program);
            
            // Compila i campi del form
            document.getElementById('program-name').value = program.name || '';
            document.getElementById('start-time').value = program.activation_time || '';
            document.getElementById('recurrence').value = program.recurrence || 'giornaliero';

            if (program.recurrence === 'personalizzata' && program.interval_days) {
                document.getElementById('custom-days-interval').value = program.interval_days;
                toggleDaysSelection();
            }

            // Seleziona i mesi
            const monthItems = Array.from(document.querySelectorAll('.month-item'));
            (program.months || []).forEach(month => {
                const monthItem = monthItems.find(item => item.textContent === month);
                if (monthItem) {
                    monthItem.classList.add('selected');
                }
            });

            // Seleziona le zone e imposta le durate
            (program.steps || []).forEach(step => {
                const zoneItems = Array.from(document.querySelectorAll('.zone-item'));
                zoneItems.forEach(item => {
                    const zoneIdInput = item.querySelector('.zone-duration');
                    if (zoneIdInput && parseInt(zoneIdInput.dataset.zoneId) === step.zone_id) {
                        item.classList.add('selected');
                        zoneIdInput.value = step.duration || 1;
                    }
                });
            });
            
            // Salva l'ID del programma
            window.editingProgramId = programId;
            
            console.log("Form compilato con i dati del programma");
        })
        .catch(error => {
            console.error('Errore nel caricamento del programma:', error);
            showToast('Errore nel caricamento del programma', 'error');
        });
}

function saveProgram() {
    const programName = document.getElementById('program-name').value.trim();
    const startTime = document.getElementById('start-time').value;
    const recurrence = document.getElementById('recurrence').value;

    // Validazione della lunghezza del nome del programma
    if (programName.length > 16) {
        showToast('Il nome del programma non può superare 16 caratteri', 'error');
        return;
    }

    const selectedMonths = Array.from(document.querySelectorAll('.month-item.selected')).map(item => item.textContent);
    
    const selectedZones = [];
    const zoneItems = document.querySelectorAll('.zone-item.selected');
    
    for (const item of zoneItems) {
        const durationInput = item.querySelector('.zone-duration');
        const duration = parseInt(durationInput.value);
        
        if (isNaN(duration) || duration <= 0) {
            showToast('Inserisci una durata valida per tutte le zone selezionate', 'error');
            return;
        }
        
        selectedZones.push({
            zone_id: parseInt(durationInput.dataset.zoneId),
            duration: duration
        });
    }

    if (!programName || !startTime || selectedMonths.length === 0 || selectedZones.length === 0) {
        showToast('Compila tutti i campi e seleziona almeno un mese e una zona', 'error');
        return;
    }

    // Imposta intervallo personalizzato se necessario
    let interval_days = null;
    if (recurrence === 'personalizzata') {
        interval_days = parseInt(document.getElementById('custom-days-interval').value);
        if (isNaN(interval_days) || interval_days <= 0) {
            showToast('Inserisci un intervallo di giorni valido', 'error');
            return;
        }
    }

    const updatedProgram = {
        id: window.editingProgramId,
        name: programName,
        activation_time: startTime,
        recurrence: recurrence,
        months: selectedMonths,
        steps: selectedZones
    };
    
    if (interval_days) {
        updatedProgram.interval_days = interval_days;
    }

    showToast('Salvataggio in corso...', 'info');
    
    fetch('/update_program', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProgram)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showToast('Programma aggiornato con successo!', 'success');
            localStorage.removeItem('editProgramId');
            
            // Ritardo prima di reindirizzare
            setTimeout(() => {
                window.location.href = 'main.html';
            }, 1000);
        } else {
            showToast('Errore durante l\'aggiornamento del programma: ' + (data.error || 'Errore sconosciuto'), 'error');
        }
    })
    .catch(error => {
        console.error('Errore durante l\'aggiornamento:', error);
        showToast('Errore di rete durante l\'aggiornamento', 'error');
    });
}

function cancelEdit() {
    if (confirm('Sei sicuro di voler annullare le modifiche?')) {
        localStorage.removeItem('editProgramId');
        window.location.href = 'main.html';
    }
}

function toggleDaysSelection() {
    const recurrence = document.getElementById('recurrence').value;
    const daysContainer = document.getElementById('days-container');
    daysContainer.style.display = (recurrence === 'personalizzata') ? 'block' : 'none';
}

function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
        window.showToast(message, type);
    } else {
        alert(message);
    }
}

// Inizializzazione quando il documento è caricato
document.addEventListener('DOMContentLoaded', initializeModifyProgramPage);