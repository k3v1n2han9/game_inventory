import datetime
import time

import requests

while True:
    res = requests.get('http://localhost:3210/check-game/653341027603')
    print(datetime.datetime.now())
    time.sleep(3600)
