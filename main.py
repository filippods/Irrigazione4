from wifi_manager import initialize_network, reset_wifi_module, retry_client_connection
from web_server import start_web_server
from zone_manager import initialize_pins
from program_manager import check_programs, reset_program_state
from log_manager import log_event
import uasyncio as asyncio
import gc

async def program_check_loop():
    while True:
        try:
            await check_programs()  # Usa await qui
            await asyncio.sleep(30)
        except Exception as e:
            log_event(f"Errore durante il controllo dei programmi: {e}", "ERROR")
            await asyncio.sleep(30)  # Attende 30 secondi prima del prossimo controllo

async def main():
    try:
        log_event("Avvio del sistema di irrigazione", "INFO")
        print("Disattivazione Bluetooth, se presente...")
        try:
            import bluetooth
            bt = bluetooth.BLE()
            bt.active(False)
            log_event("Bluetooth disattivato", "INFO")
        except ImportError:
            print("Modulo Bluetooth non presente.")
        
        # Pulizia memoria
        gc.collect()
        
        # Inizializza la rete
        try:
            print("Inizializzazione della rete WiFi...")
            initialize_network()
            log_event("Rete WiFi inizializzata", "INFO")
        except Exception as e:
            log_event(f"Errore durante l'inizializzazione della rete WiFi: {e}", "ERROR")
            # Riprova con reset
            try:
                reset_wifi_module()
                initialize_network()
                log_event("Rete WiFi inizializzata dopo reset", "INFO")
            except Exception as e:
                log_event(f"Impossibile inizializzare la rete WiFi: {e}", "ERROR")
                print("Continuazione con funzionalità limitate...")

        # Resetta lo stato del programma all'avvio
        reset_program_state()
        log_event("Stato del programma resettato", "INFO")
        
        # Inizializza le zone
        if not initialize_pins():
            log_event("Errore: Nessuna zona inizializzata correttamente.", "ERROR")
            print("Errore: Nessuna zona inizializzata correttamente.")
        else:
            log_event("Zone inizializzate correttamente.", "INFO")
            print("Zone inizializzate correttamente.")
        
        # Avvia i task asincroni
        print("Avvio del web server...")
        asyncio.create_task(start_web_server())
        log_event("Web server avviato", "INFO")
        
        print("Avvio del controllo dei programmi...")
        asyncio.create_task(program_check_loop())
        log_event("Loop di controllo programmi avviato", "INFO")
        
        # Avvia il task per il retry della connessione WiFi
        asyncio.create_task(retry_client_connection())
        log_event("Task di retry connessione WiFi avviato", "INFO")

        # Mantiene il loop in esecuzione
        while True:
            await asyncio.sleep(1)

    except Exception as e:
        log_event(f"Errore critico nel main: {e}", "ERROR")
        print(f"Errore critico: {e}")
        # Riavvia il sistema in caso di errore critico
        import machine
        machine.reset()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"Errore nell'avvio del main: {e}")
        import machine
        machine.reset()