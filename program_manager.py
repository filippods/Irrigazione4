import ujson
import time
import uasyncio as asyncio
from zone_manager import start_zone, stop_zone, stop_all_zones, get_active_zones_count
from program_state import program_running, current_program_id, save_program_state, load_program_state
from settings_manager import load_user_settings, save_user_settings, reset_user_settings, reset_factory_data, factory_reset
from log_manager import log_event

PROGRAM_STATE_FILE = '/data/program_state.json'

# Carica i programmi
def load_programs():
    try:
        with open('/data/program.json', 'r') as f:
            programs = ujson.load(f)
            # Assicura che tutti gli ID siano stringhe
            for prog_id in list(programs.keys()):
                if programs[prog_id].get('id') is None:
                    programs[prog_id]['id'] = str(prog_id)
            return programs
    except OSError:
        log_event("File program.json non trovato, creazione file vuoto", "WARNING")
        empty_programs = {}
        save_programs(empty_programs)
        return empty_programs
    except Exception as e:
        log_event(f"Errore durante il caricamento dei programmi: {e}", "ERROR")
        return {}

# Funzione per salvare i programmi
def save_programs(programs):
    try:
        with open('/data/program.json', 'w') as f:
            ujson.dump(programs, f)
        log_event("Programmi salvati con successo", "INFO")
    except OSError as e:
        log_event(f"Errore durante il salvataggio dei programmi: {e}", "ERROR")
        print(f"Errore durante il salvataggio dei programmi: {e}")

# Verifica conflitti tra programmi
def check_program_conflicts(program, programs, exclude_id=None):
    """Verifica se ci sono conflitti con altri programmi negli stessi mesi."""
    program_months = set(program.get('months', []))
    if not program_months:
        return False, ""
    
    for pid, existing_program in programs.items():
        if exclude_id and str(pid) == str(exclude_id):
            continue  # Salta il programma stesso durante la modifica
            
        existing_months = set(existing_program.get('months', []))
        if program_months.intersection(existing_months):
            # C'è una sovrapposizione nei mesi
            return True, f"Conflitto con il programma '{existing_program.get('name', '')}' nei mesi selezionati"
    
    return False, ""

# Aggiornamento di un programma esistente
def update_program(program_id, updated_program):
    program_id = str(program_id)  # Assicura che l'ID sia una stringa
    programs = load_programs()
    
    # Verifica conflitti (escludi il programma che stiamo aggiornando)
    has_conflict, conflict_message = check_program_conflicts(updated_program, programs, exclude_id=program_id)
    if has_conflict:
        log_event(f"Conflitto durante l'aggiornamento del programma {program_id}: {conflict_message}", "WARNING")
        return False, conflict_message
    
    if program_id in programs:
        # Se il programma è in esecuzione, fermalo prima di aggiornarlo
        if program_running and current_program_id == program_id:
            stop_program()
            
        programs[program_id] = updated_program
        save_programs(programs)
        log_event(f"Programma {program_id} aggiornato con successo", "INFO")
        return True, ""
    else:
        error_msg = f"Errore: Programma con ID {program_id} non trovato."
        log_event(error_msg, "ERROR")
        print(error_msg)
        return False, error_msg

# Eliminazione di un programma
def delete_program(program_id):
    program_id = str(program_id)  # Assicura che l'ID sia una stringa
    programs = load_programs()
    
    if program_id in programs:
        # Se il programma è in esecuzione, fermalo prima di eliminarlo
        if program_running and current_program_id == program_id:
            stop_program()
            
        del programs[program_id]
        save_programs(programs)
        log_event(f"Programma {program_id} eliminato con successo", "INFO")
        return True
    else:
        error_msg = f"Errore: Programma con ID {program_id} non trovato."
        log_event(error_msg, "ERROR")
        print(error_msg)
        return False

# Controlla se il programma è attivo nel mese corrente
def is_program_active_in_current_month(program):
    current_month = time.localtime()[1]
    months_map = {
        "Gennaio": 1, "Febbraio": 2, "Marzo": 3, "Aprile": 4,
        "Maggio": 5, "Giugno": 6, "Luglio": 7, "Agosto": 8,
        "Settembre": 9, "Ottobre": 10, "Novembre": 11, "Dicembre": 12
    }
    program_months = [months_map[month] for month in program.get('months', []) if month in months_map]
    return current_month in program_months

# Verifica se il programma è previsto per oggi
def is_program_due_today(program):
    current_day_of_year = time.localtime()[7]
    last_run_day = -1

    if 'last_run_date' in program:
        try:
            last_run_day = time.strptime(program['last_run_date'], '%Y-%m-%d')[7]
        except Exception as e:
            log_event(f"Errore nella conversione della data di esecuzione: {e}", "ERROR")
            print(f"Errore nella conversione della data di esecuzione: {e}")

    recurrence = program.get('recurrence', 'giornaliero')
    
    if recurrence == 'giornaliero':
        return last_run_day != current_day_of_year
    elif recurrence == 'giorni_alterni':
        # Esegui ogni 2 giorni
        return (current_day_of_year - last_run_day) >= 2
    elif recurrence == 'personalizzata':
        interval_days = program.get('interval_days', 1)
        if interval_days <= 0:
            interval_days = 1  # Fallback sicuro
        return (current_day_of_year - last_run_day) >= interval_days
    
    return False

async def execute_program(program, manual=False):
    global program_running, current_program_id
    
    if program_running:
        log_event(f"Impossibile eseguire il programma: un altro programma è già in esecuzione ({current_program_id})", "WARNING")
        print(f"Un altro programma è già in esecuzione: {current_program_id}.")
        return False

    # Se è un programma automatico, prima arresta tutte le zone manuali
    # I programmi automatici hanno priorità come richiesto nel prompt
    if not manual:
        active_count = get_active_zones_count()
        if active_count > 0:
            log_event("Arresto di tutte le zone attive per dare priorità al programma automatico", "INFO")
            stop_all_zones()
            await asyncio.sleep(1)  # Piccolo ritardo per sicurezza

    # Spegni tutte le zone prima di avviare un nuovo programma
    stop_all_zones()

    program_id = str(program.get('id', '0'))  # Assicura che l'ID sia una stringa
    
    program_running = True
    current_program_id = program_id
    save_program_state()
    
    log_event(f"Avvio del programma: {program.get('name', 'Senza nome')} (ID: {program_id})", "INFO")

    settings = load_user_settings()
    activation_delay = settings.get('activation_delay', 0)
    
    try:
        for i, step in enumerate(program.get('steps', [])):
            if not program_running:
                log_event("Programma interrotto dall'utente.", "INFO")
                print("Programma interrotto dall'utente.")
                break

            zone_id = step.get('zone_id')
            duration = step.get('duration', 1)
            
            if zone_id is None:
                log_event(f"Errore nel passo {i+1}: zone_id mancante", "ERROR")
                continue
                
            log_event(f"Attivazione della zona {zone_id} per {duration} minuti.", "INFO")
            print(f"Attivazione della zona {zone_id} per {duration} minuti.")
            
            # Avvia la zona
            result = start_zone(zone_id, duration)
            if not result:
                log_event(f"Errore nell'attivazione della zona {zone_id}", "ERROR")
                continue
                
            # Aspetta per la durata specificata
            for _ in range(duration * 60):
                if not program_running:
                    break
                await asyncio.sleep(1)
            
            if not program_running:
                break
                
            # Ferma la zona
            stop_zone(zone_id)
            log_event(f"Zona {zone_id} completata.", "INFO")
            print(f"Zona {zone_id} completata.")

            # Applica il ritardo di attivazione tra le zone
            if activation_delay > 0 and i < len(program.get('steps', [])) - 1:
                log_event(f"Attesa di {activation_delay} minuti prima della prossima zona.", "INFO")
                for _ in range(activation_delay * 60):
                    if not program_running:
                        break
                    await asyncio.sleep(1)
    finally:
        program_running = False
        current_program_id = None
        save_program_state()
        update_last_run_date(program_id)
        log_event(f"Programma {program.get('name', 'Senza nome')} completato", "INFO")
        return True

# Ferma un programma
def stop_program():
    global program_running, current_program_id
    
    if not program_running:
        log_event("Nessun programma in esecuzione da interrompere", "INFO")
        return False
        
    log_event(f"Interruzione del programma {current_program_id} in corso.", "INFO")
    print("Interruzione del programma in corso.")
    program_running = False
    current_program_id = None
    save_program_state()  # Assicurati che lo stato venga salvato correttamente

    # Aggiungi il codice per fermare tutte le zone attualmente attive
    stop_all_zones()
    log_event("Tutte le zone sono state arrestate", "INFO")
    return True

def reset_program_state():
    global program_running, current_program_id
    program_running = False
    current_program_id = None
    save_program_state()
    log_event("Stato del programma resettato", "INFO")

async def check_programs():
    # Carica le impostazioni per verificare se i programmi automatici sono abilitati
    settings = load_user_settings()
    if not settings.get('automatic_programs_enabled', False):
        return

    programs = load_programs()
    if not programs:
        return
        
    current_time_str = time.strftime('%H:%M', time.localtime())

    for program_id, program in programs.items():
        activation_time = program.get('activation_time', '')
        
        if (current_time_str == activation_time and
            is_program_active_in_current_month(program) and
            is_program_due_today(program)):
            
            log_event(f"Avvio del programma pianificato: {program.get('name', 'Senza nome')}", "INFO")
            print(f"Avvio del programma pianificato: {program.get('name', 'Senza nome')}")
            
            # Se c'è già un programma in esecuzione, non fare nulla
            if program_running:
                log_event("Impossibile avviare il programma: un altro programma è già in esecuzione", "WARNING")
                continue
                
            # Avvia il programma
            success = await execute_program(program)
            if success:
                update_last_run_date(program_id)

# Aggiorna la data dell'ultima esecuzione del programma
def update_last_run_date(program_id):
    program_id = str(program_id)  # Assicura che l'ID sia una stringa
    current_date = time.strftime('%Y-%m-%d', time.localtime())
    programs = load_programs()
    
    if program_id in programs:
        programs[program_id]['last_run_date'] = current_date
        save_programs(programs)
        log_event(f"Data ultima esecuzione aggiornata per il programma {program_id}: {current_date}", "INFO")