import json

import requests


def get_info(j=False):
    f = open('items.txt', 'rb')
    item_str = str(f.read(), 'utf-8')
    items = []
    for line in item_str.strip().split('\n'):
        line = line.replace('\r', '')
        line_content = line.split('	')
        items.append({
            'name': line_content[0],
            'itemId': line_content[1]
        })
    url = 'https://staplescms.staples.ca/api/inventory'
    template = {
        "ivrequest": {
            "postalCode": "V6X3J9",
            "channel": "WEB",
            "tenantId": "StaplesCA",
            "locale": "en-CA",
            "operationMode": "REALTIME",
            "items": [{'itemId': a['itemId'], 'requestedquantity': 1000} for a in items]
        }
    }
    headers = {
        'origin': 'https://www.staples.ca',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-site',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.130 Safari/537.36',
        'x-ibm-client-id': '94d817c8-21f4-4420-99b5-f6ba018d32bc',
        'content-type': 'application/json',
    }
    res = requests.post(url, data=json.dumps(template), headers=headers)
    result_items = res.json()['items']
    ret = ''
    ret_json = []
    for index in range(0, len(items)):
        name = items[index]['name']
        quantity = result_items[index]['availablequantity']
        ret += name + ' : ' + \
               str(quantity) + \
               ' <a href="https://www.staples.ca/search?query=' + \
               items[index]['itemId'] + \
               '" target="_blank">买</a><br>'
        ret_json.append({
            'name': items[index]['name'],
            'qty': result_items[index]['availablequantity'],
            'link': 'https://www.staples.ca/search?query=' + items[index]['itemId']
        })
    if j:
        return ret_json
    else:
        return ret
