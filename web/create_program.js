// Verifica se editingProgram è già stato dichiarato
if (typeof editingProgram === 'undefined') {
    var editingProgram = null; // Definisci editingProgram come variabile globale solo se non esiste già
}

// Funzione per inizializzare la pagina Crea Programma
function initializeCreateProgramPage() {
    // Verifica se stiamo modificando un programma esistente
    const editProgramId = localStorage.getItem('editProgramId');
    if (editProgramId) {
        editingProgram = parseInt(editProgramId);
    }

    fetch('/data/user_settings.json')
        .then(response => response.json())
        .then(userData => {
            const zones = userData.zones;
            const monthsContainer = document.getElementById('months-list');
            const zoneContainer = document.getElementById('zone-list');

            // Mesi
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

            // Zone
            zones.forEach(zone => {
                if (zone.status === "show") {
                    const zoneItem = document.createElement('div');
                    zoneItem.className = 'zone-item';
                    zoneItem.innerHTML = `
                        <span>${zone.name}</span>
                        <input type="number" class="zone-duration" placeholder="Durata (min)" data-zone-id="${zone.id}">
                    `;
                    zoneItem.addEventListener('click', () => {
                        zoneItem.classList.toggle('selected');
                    });
                    zoneContainer.appendChild(zoneItem);
                }
            });
        })
        .catch(error => {
            console.error('Errore nel caricamento dei dati utente:', error);
            alert('Errore nel caricamento dei dati utente.');
        });
}

// Funzione per salvare il programma
function saveProgram() {
    const programName = document.getElementById('program-name').value.trim();
    const startTime = document.getElementById('start-time').value;
    const recurrence = document.getElementById('recurrence').value;

    // Validazione della lunghezza del nome del programma
    if (programName.length > 16) {
        alert('Il nome del programma non può superare 16 caratteri.');
        return;
    }

    const selectedMonths = Array.from(document.querySelectorAll('.month-item.selected')).map(item => item.textContent);
    const selectedZones = Array.from(document.querySelectorAll('.zone-item.selected')).map(item => {
        const duration = parseInt(item.querySelector('.zone-duration').value);
        if (isNaN(duration) || duration <= 0) {
            alert('Inserisci una durata valida per tutte le zone selezionate.');
            throw new Error('Invalid zone duration');
        }
        return {
            zone_id: parseInt(item.querySelector('.zone-duration').dataset.zoneId),
            duration: duration
        };
    });

    if (!programName || !startTime || selectedMonths.length === 0 || selectedZones.length === 0) {
        alert('Compila tutti i campi e seleziona almeno un mese e una zona.');
        return;
    }

    const newProgram = {
        name: programName,
        activation_time: startTime,
        recurrence: recurrence,
        months: selectedMonths,
        steps: selectedZones
    };

    let apiUrl = '/save_program';
    let method = 'POST';

    if (editingProgram) {
        newProgram.id = editingProgram;
        apiUrl = '/update_program';
        method = 'PUT';
    }

    fetch(apiUrl, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProgram)
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Programma salvato con successo!');
            localStorage.removeItem('editProgramId');
            window.location.href = 'main.html';
        } else {
            alert('Errore durante il salvataggio del programma: ' + data.error);
        }
    })
    .catch(error => console.error('Errore durante il salvataggio:', error));
}

// Funzione per gestire la selezione di giorni personalizzati
function toggleDaysSelection() {
    const recurrence = document.getElementById('recurrence').value;
    const daysContainer = document.getElementById('days-container');
    daysContainer.style.display = (recurrence === 'personalizzata') ? 'block' : 'none';
}

// Inizializza la pagina quando il documento è caricato
document.addEventListener('DOMContentLoaded', initializeCreateProgramPage);
