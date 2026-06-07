from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import threading
import http.server
import socketserver
import time
import os

# Set up server
PORT = 8000
Handler = http.server.SimpleHTTPRequestHandler
httpd = socketserver.TCPServer(("", PORT), Handler)

def start_server():
    httpd.serve_forever()

server_thread = threading.Thread(target=start_server)
server_thread.daemon = True
server_thread.start()

time.sleep(1)

# Set up Selenium
options = webdriver.ChromeOptions()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

try:
    driver = webdriver.Chrome(options=options)
    
    # Test 1: index.html -> default ebook navigation
    print("Testing index.html navigation to default ebook")
    driver.get(f"http://localhost:{PORT}/index.html")
    time.sleep(1) # wait for load
    
    # In index.html, click the Ebook nav item
    driver.execute_script("goToEbook()")
    time.sleep(1)
    
    current_url = driver.current_url
    print(f"URL after goToEbook(): {current_url}")
    assert 'ebook-cardss-pt.html' in current_url, "Expected to navigate to pt ebook by default"
    
    # Test 2: Switch language from ebook-cardss-pt.html
    print("Testing language switch from ebook-cardss-pt.html to en")
    driver.execute_script("setLang('en')")
    time.sleep(1)
    current_url = driver.current_url
    print(f"URL after setLang('en'): {current_url}")
    assert 'ebook-cardss-en.html' in current_url, "Expected to navigate to en ebook"
    
    # Test 3: Switch language from ebook-cardss-en.html to es
    print("Testing language switch from ebook-cardss-en.html to es")
    driver.execute_script("setLang('es')")
    time.sleep(1)
    current_url = driver.current_url
    print(f"URL after setLang('es'): {current_url}")
    assert 'ebook-cardss-es.html' in current_url, "Expected to navigate to es ebook"
    
    print("All tests passed!")
    
except Exception as e:
    print(f"Test failed: {e}")
finally:
    driver.quit()
    httpd.shutdown()

