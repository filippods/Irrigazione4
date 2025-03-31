import network
import ujson
import time
import gc
import uos
from settings_manager import load_user_settings, save_user_settings
from log_manager import log_event
import uasyncio as asyncio

WIFI_RETRY_INTERVAL = 30
MAX_WIFI_RETRIES = 5
AP_SSID_DEFAULT = "IrrigationSystem"
AP_PASSWORD_DEFAULT = "12345678"
wifi_scan_file = '/data/wifi_scan.json'

def reset_wifi_module():
    """Disattiva e riattiva il modulo WiFi per forzare un reset completo"""
    try:
        wlan_sta = network.WLAN(network.STA_IF)
        wlan_ap = network.WLAN(network.AP_IF)
        
        log_event("Reset del modulo WiFi in corso...", "INFO")
        print("Resetting WiFi module...")
        wlan_sta.active(False)
        wlan_ap.active(False)
        
        time.sleep(1)
        wlan_sta.active(True)
        log_event("Reset del modulo WiFi completato", "INFO")
        print("WiFi module reset completed.")
        return True
    except Exception as e:
        log_event(f"Errore durante il reset del modulo WiFi: {e}", "ERROR")
        print(f"Errore durante il reset del modulo WiFi: {e}")
        return False

def save_wifi_scan_results(network_list):
    """Salva i risultati della scansione Wi-Fi nel file wifi_scan.json."""
    try:
        with open(wifi_scan_file, 'w') as f:
            ujson.dump(network_list, f)
        log_event(f"Risultati della scansione Wi-Fi salvati correttamente in {wifi_scan_file}", "INFO")
        print(f"Risultati della scansione Wi-Fi salvati correttamente in {wifi_scan_file}")
    except OSError as e:
        log_event(f"Errore durante il salvataggio dei risultati della scansione Wi-Fi: {e}", "ERROR")
        print(f"Errore durante il salvataggio dei risultati della scansione Wi-Fi: {e}")

# Aggiungiamo una funzione per azzerare il file wifi_scan.json
def clear_wifi_scan_file():
    file_path = '/data/wifi_scan.json'
    try:
        with open(file_path, 'w') as f:
            ujson.dump([], f)  # Salviamo un array vuoto
            log_event(f"File {file_path} azzerato correttamente", "INFO")
            print(f"File {file_path} azzerato correttamente.")
    except Exception as e:
        log_event(f"Errore nell'azzerare il file {file_path}: {e}", "ERROR")
        print(f"Errore nell'azzerare il file {file_path}: {e}")
        
def connect_to_wifi(ssid, password):
    """Tenta di connettersi a una rete WiFi in modalità client"""
    wlan_sta = network.WLAN(network.STA_IF)
    log_event(f"Tentativo di connessione alla rete WiFi: {ssid}", "INFO")
    print(f"Trying to connect to WiFi SSID: {ssid}...")

    try:
        wlan_sta.active(True)
        retries = 0

        while not wlan_sta.isconnected() and retries < MAX_WIFI_RETRIES:
            wlan_sta.connect(ssid, password)
            time.sleep(5)
            retries += 1

        if wlan_sta.isconnected():
            ip = wlan_sta.ifconfig()[0]
            log_event(f"Connesso con successo alla rete WiFi: {ssid} con IP {ip}", "INFO")
            print(f"Connected successfully to WiFi: {ip}")
            return True
        else:
            log_event(f"Impossibile connettersi alla rete WiFi: {ssid}", "ERROR")
            print("Failed to connect to WiFi.")
            wlan_sta.active(False)
            return False
    except Exception as e:
        log_event(f"Errore durante la connessione alla rete WiFi: {e}", "ERROR")
        print(f"Errore durante la connessione alla rete WiFi: {e}")
        wlan_sta.active(False)
        return False

def start_access_point(ssid=None, password=None):
    try:
        settings = load_user_settings()  # Carica le impostazioni utente

        # Se SSID o password non sono passati come parametri, carica dalle impostazioni
        ap_config = settings.get('ap', {})
        ssid = ssid or ap_config.get('ssid', AP_SSID_DEFAULT)  # Default SSID se non presente
        password = password or ap_config.get('password', AP_PASSWORD_DEFAULT)  # Default password se non presente

        wlan_ap = network.WLAN(network.AP_IF)
        wlan_ap.active(True)

        # Configura l'AP con il SSID e la password
        if password and len(password) >= 8:
            wlan_ap.config(essid=ssid, password=password, authmode=3)  # 3 è WPA2
            auth_mode = "WPA2"
        else:
            wlan_ap.config(essid=ssid)  # AP sarà aperto se non è presente una password
            auth_mode = "Aperto"

        log_event(f"Access Point attivato con SSID: '{ssid}', sicurezza: {auth_mode}", "INFO")
        print(f"Access Point attivato con SSID: '{ssid}', sicurezza {'WPA2' if password else 'Nessuna'}")
        return True
    except Exception as e:
        log_event(f"Errore durante l'attivazione dell'Access Point: {e}", "ERROR")
        print(f"Errore durante l'attivazione dell'Access Point: {e}")
        try:
            wlan_ap.active(False)
        except:
            pass
        return False

def initialize_network():
    gc.collect()  # Effettua la garbage collection per liberare memoria
    settings = load_user_settings()
    if not isinstance(settings, dict):
        log_event("Errore: impostazioni utente non disponibili", "ERROR")
        print("Errore: impostazioni utente non disponibili.")
        return False

    client_enabled = settings.get('client_enabled', False)

    if client_enabled:
        # Modalità client attiva
        ssid = settings.get('wifi', {}).get('ssid')
        password = settings.get('wifi', {}).get('password')

        if ssid and password:
            success = connect_to_wifi(ssid, password)
            if success:
                log_event("Modalità client attivata con successo", "INFO")
                print("Modalità client attivata con successo.")
                return True
            else:
                log_event("Connessione alla rete WiFi fallita, passando alla modalità AP", "WARNING")
                print("Connessione alla rete WiFi fallita, passando alla modalità AP.")
                # Se la connessione fallisce, disabilita la modalità client
                settings['client_enabled'] = False
                save_user_settings(settings)
        else:
            log_event("SSID o password non validi per il WiFi client", "WARNING")
            print("SSID o password non validi per il WiFi client.")

    # Se il client è disattivato o fallisce, avvia l'AP
    ap_ssid = settings.get('ap', {}).get('ssid', AP_SSID_DEFAULT)
    ap_password = settings.get('ap', {}).get('password', AP_PASSWORD_DEFAULT)
    success = start_access_point(ap_ssid, ap_password)
    return success

async def retry_client_connection():
    """
    Task asincrono che verifica periodicamente la connessione WiFi client e tenta di riconnettersi se necessario.
    """
    while True:
        try:
            await asyncio.sleep(WIFI_RETRY_INTERVAL)
            wlan_sta = network.WLAN(network.STA_IF)
            settings = load_user_settings()

            client_enabled = settings.get('client_enabled', False)

            if client_enabled:
                if not wlan_sta.isconnected():
                    log_event("Connessione WiFi client persa, tentativo di riconnessione...", "WARNING")
                    ssid = settings.get('wifi', {}).get('ssid')
                    password = settings.get('wifi', {}).get('password')
                    if ssid and password:
                        success = connect_to_wifi(ssid, password)
                        if not success:
                            log_event(f"Impossibile riconnettersi a '{ssid}'. Attivazione della rete AP", "ERROR")
                            print(f"Impossibile riconnettersi a '{ssid}'. Attivazione della rete AP.")
                            settings['client_enabled'] = False
                            save_user_settings(settings)
                            start_access_point()
                    else:
                        log_event("SSID o password non validi. Impossibile riconnettersi", "ERROR")
                        print("SSID o password non validi. Impossibile riconnettersi.")
                else:
                    # Connessione attiva, nessuna azione necessaria
                    pass
            else:
                if wlan_sta.active():
                    log_event("Disattivazione della modalità client", "INFO")
                    print("Disattivazione della modalità client.")
                    wlan_sta.active(False)
                    
                # Assicurati che l'AP sia attivo
                wlan_ap = network.WLAN(network.AP_IF)
                if not wlan_ap.active():
                    log_event("AP non attivo, riattivazione...", "WARNING")
                    start_access_point()
        
        except Exception as e:
            log_event(f"Errore durante il retry della connessione WiFi: {e}", "ERROR")
            print(f"Errore durante il retry della connessione WiFi: {e}")
            await asyncio.sleep(5)  # Breve ritardo prima di riprovare in caso di errore