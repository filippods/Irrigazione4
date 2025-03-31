import ujson
import time
import uos
import gc

LOG_FILE = '/data/system_log.json'
MAX_LOG_DAYS = 10  # Mantiene log per 10 giorni come richiesto nel prompt

def _ensure_log_file_exists():
    try:
        uos.stat(LOG_FILE)
    except OSError:
        # File non esiste, crealo
        with open(LOG_FILE, 'w') as f:
            ujson.dump([], f)

def _get_current_date():
    t = time.localtime()
    return f"{t[0]}-{t[1]:02d}-{t[2]:02d}"

def _get_current_time():
    t = time.localtime()
    return f"{t[3]:02d}:{t[4]:02d}:{t[5]:02d}"

def log_event(message, level="INFO"):
    """
    Registra un evento nel log di sistema.
    Livelli: INFO, WARNING, ERROR
    """
    try:
        _ensure_log_file_exists()
        
        # Leggi i log esistenti
        try:
            with open(LOG_FILE, 'r') as f:
                logs = ujson.load(f)
        except (OSError, ValueError):
            logs = []
        
        # Aggiungi nuovo log
        current_date = _get_current_date()
        current_time = _get_current_time()
        
        new_log = {
            "date": current_date,
            "time": current_time,
            "level": level,
            "message": message
        }
        
        logs.append(new_log)
        
        # Rimuovi i log più vecchi di MAX_LOG_DAYS
        now = time.time()
        current_day = time.localtime(now)[7]  # Giorno dell'anno
        
        filtered_logs = []
        for log in logs:
            try:
                log_date = log.get("date", "")
                if log_date:
                    log_day = time.localtime(time.mktime(time.strptime(log_date, "%Y-%m-%d")))[7]
                    if current_day - log_day <= MAX_LOG_DAYS or log_day > current_day:  # Gestisce cambio anno
                        filtered_logs.append(log)
            except Exception:
                # Se c'è un errore nella data, mantieni il log (meglio sicuri)
                filtered_logs.append(log)
        
        # Salva i log filtrati
        with open(LOG_FILE, 'w') as f:
            ujson.dump(filtered_logs, f)
            
        # Stampa anche a console per debug
        print(f"[{level}] {current_time}: {message}")
        
        # Forza garbage collection dopo operazioni su file
        gc.collect()
        
    except Exception as e:
        print(f"Errore durante la registrazione nel log: {e}")

def get_logs():
    """Restituisce tutti i log salvati."""
    try:
        _ensure_log_file_exists()
        with open(LOG_FILE, 'r') as f:
            return ujson.load(f)
    except Exception as e:
        print(f"Errore durante la lettura dei log: {e}")
        return []

def clear_logs():
    """Cancella tutti i log."""
    try:
        with open(LOG_FILE, 'w') as f:
            ujson.dump([], f)
        return True
    except Exception as e:
        print(f"Errore durante la cancellazione dei log: {e}")
        return False