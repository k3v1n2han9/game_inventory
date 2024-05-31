import requests
from bs4 import BeautifulSoup

headers = {
    'cookie': '_ga=GA1.3.448794450.1574839087; _gid=GA1.3.87521724.1576977657; _gat=1; XSRF-TOKEN=eyJpdiI6IkdWVUZOeWJ0N3VQR1h0a1NVN2NRN3c9PSIsInZhbHVlIjoiNHU2bW1KY0lCb1hZKzdBN1wvM0IyMFl4UElSbWxCYXlpeDRENCtaUWNiT21vY0xXTTRGdnAxOVNzUG50cUd3ZzEiLCJtYWMiOiIxNzRmNjEzMTMxYTk3YmYxNDc1MTE5OGFiNjhiMTExN2U0Y2JkZmIzY2JmOGUyMTQwYjdjMWQ2NTliNDQzZDFhIn0%3D; vr=eyJpdiI6ImNIZHdTRUlrZDNoT093T1VJQnB3Wnc9PSIsInZhbHVlIjoiZm9RdkJHblZVbGx2eW5ObXN1elVxbHExcHplWlVIU0pORzczZUsyWHVaWlBjK0NjU0d1S3FTcEYrMTVzeU1kSSIsIm1hYyI6IjkzMzk4NTU3MGEyMzM0M2UxNDc1YWVmZjg3NmZmOWEwOWM1OGE2NTMwZjgxNjMyODg2MmYwNWUwNzAyYWNiMzgifQ%3D%3D; AWSALB=eMqkb3HVGyXi2kHuvoNomdeqBmcUUEv62XPchfb40ISqmWiWjkksHYPBjmbENhp7xc5x1DppPopfEeufrm+vNYynptOgRir40SafHFTQ88ZtgMMZFuC6NXYR2h6Z'
}
res = requests.get('https://vrdistribution.com.au/search?q=689070017400', headers=headers)
print(res.text)
# 从这里开始复制
soup = BeautifulSoup(res.text, 'lxml')
product_box_soup = soup.find('div', {"class": "product-box"})
ret = {
    'status': 'Not Found',
    'barcode': '',
    'date': ''
}
if product_box_soup is not None:
    basic_info = product_box_soup.find('div', {'class': 'col-xs-7'}).get_text()
    barcode = basic_info.split('Barcode\n')[1].split('\n')[0]
    num_on = '0'
    try:
        if 'Pre-Order' in basic_info:
            num_on = '0'
        else:
            if 'Shipments' in basic_info:
                date = basic_info.split('Upcoming Shipments')[1].strip()
            else:
                date = basic_info.split('Upcoming Shipment')[1].strip()
            filter_break = [a.strip() for a in date.split('\n') if a != '' and '(' in a]
            num_on = filter_break[-1]
            num_on = num_on.split('(')[1].strip()
            num_on = num_on.split('Ava')[0].strip()
    except IndexError:
        num_on = '0'
    try:
        if 'Pre-Order' in basic_info:
            date = basic_info.split('Release Date')[1].split('estimated')[0].strip()
        else:
            if 'Shipments' in basic_info:
                date = basic_info.split('Upcoming Shipments')[1].strip()
            else:
                date = basic_info.split('Upcoming Shipment')[1].strip()
            filter_break = [a.strip() for a in date.split('\n') if a != '' and '(' not in a]
            date = filter_break[-1]
            if 'in' in date:
                date = date.split('in')[1]
            elif 'on' in date:
                date = date.split('on')[1]
            date = date.strip()
    except IndexError:
        date = ''
    status_soup = product_box_soup.find('div', {'class': 'stock-status-container'})
    status = status_soup.getText().strip()
    num_on = num_on.replace('+', '')
    if int(num_on) < 10:
        num_on = '0' + num_on
    ret = {
        'status': status,
        'barcode': barcode,
        'date': date,
        'num_on': num_on
    }
# 到这里结束
print(ret)
