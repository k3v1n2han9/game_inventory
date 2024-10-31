import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, request
from flask_cors import CORS

import mask

app = Flask(__name__)
CORS(app)


@app.route("/")
def hello_world():
    return "Hello, Amazon!"


def check_lpg(game_code):
    url = "https://pb90nuup1o-dsn.algolia.net/1/indexes/*/queries?x-algolia-agent=Algolia%20for%20JavaScript%20(3.35.1)%3B%20Browser%3B%20Magento2%20integration%20(3.7.0)%3B%20autocomplete.js%200.38.1&x-algolia-application-id=PB90NUUP1O&x-algolia-api-key=NzhhN2Y1ZGExOGFjYzU3MDViYTVkY2JmMDhmNGQzNGJkOGYyYzI2YmI0ZjVjZjkyODViMGE2ODU5NzAyNDBkMHRhZ0ZpbHRlcnM9"

    headers = {
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,zh-TW;q=0.6",
        "Connection": "keep-alive",
        "DNT": "1",
        "Origin": "https://letsplaygames.com.au",
        "Referer": "https://letsplaygames.com.au/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "accept": "application/json",
        "content-type": "application/x-www-form-urlencoded",
        "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }

    data = {
        "requests": [
            {
                "indexName": "lpg_production_lpg_categories",
                "params": f"query={game_code}&hitsPerPage=3&analyticsTags=autocomplete&clickAnalytics=true",
            },
            {
                "indexName": "lpg_production_lpg_products",
                "params": f"query={game_code}&hitsPerPage=8&analyticsTags=autocomplete&clickAnalytics=true&facets=%5B%22categories.level0%22%5D&numericFilters=visibility_search%3D1&ruleContexts=%5B%22magento_filters%22%2C%22%22%5D",
            },
            {
                "indexName": "lpg_production_lpg_pages",
                "params": f"query={game_code}&hitsPerPage=2&analyticsTags=autocomplete&clickAnalytics=true",
            },
        ]
    }

    response = requests.post(url, headers=headers, json=data)

    if response.status_code == 200:
        result = response.json()
        for res in result.get("results", []):
            if res.get("index") == "lpg_production_lpg_products":
                hits = res.get("hits", [])
                if hits:
                    gg_availability = hits[0].get("gg_availability", "Unknown")
                    stock_qty = hits[0].get("stock_qty", 0)
                    return f"{gg_availability} (stock qty {stock_qty})"
        return "not found"
    else:
        print(f"Request failed with status code {response.status_code}")
        return "not found"


def check_vr(game, outside):
    headers = {
        "cookie": "_ga=GA1.3.1347277173.1666082159; _gid=GA1.3.1183940890.1668950855; AWSALB=hRZJ4XunJR3bkiIz+YdoTd6ZmdxN4DC3aQQfoyetHubu6x9jWhx73xbPizPlfOM9OG24CrdqMzmMR8Uiy1DUQL642L31WxapQU/B2Iw8Xf3IyyuSOcbdgVCBJKOG; AWSALBCORS=hRZJ4XunJR3bkiIz+YdoTd6ZmdxN4DC3aQQfoyetHubu6x9jWhx73xbPizPlfOM9OG24CrdqMzmMR8Uiy1DUQL642L31WxapQU/B2Iw8Xf3IyyuSOcbdgVCBJKOG; itemsPerPage=eyJpdiI6Ild1YlZGR1I3OHVpUE1ybW5zc3g4OXc9PSIsInZhbHVlIjoiOTBERVZNbXBrWDNlYWNjTnJTckVBQkhqbW5WTk1CRjFKNDQzeHRPdFVwMktsSGVEbnVOczBFT21PS2M0MHNHRCIsIm1hYyI6ImRkZTRmMzc3NzIxNmY0NWY2NzRkOWNlMDFiNzhhYzNmNTk4MjZlMDYyOGJlNDk2OTcxNmI0NDliZDA5YzZkZDciLCJ0YWciOiIifQ==; XSRF-TOKEN=eyJpdiI6IkM0eFZLMDF2a3loTDBTc0M1Q0tacnc9PSIsInZhbHVlIjoicy92c0p4UWo1MUVKWlFONnUxOWM0elM1aXRuakdBYzd6OXMyalE1dXFpYTM4K0ZEaEt0NW5EUmJhQng4NTRIOUFKTHpTZ3pOQVpqRkRsM0huWU1GNjljRFQ3RnpINDV4ekFsQU9pejFYZnJHVCsyOUZpT0gydmhIaHl1WkZBOFgiLCJtYWMiOiIyNjYxYjFlMzRlMDY0ZjU1MWE4MzJhZTYzOWI3ZmYzZThiMjNmZDNhOWIyNjM2OGY0ZTI1NmNjYmFiNmEyM2U5IiwidGFnIjoiIn0=; vr=eyJpdiI6IlU2czcrTUtiMFBDZllpS2xwWnpPcHc9PSIsInZhbHVlIjoiekJiUjFyV3RUdGhtckpUVFZKL0dxTWh0RWVCcUpheW51bk13ald0YVRaaXB6UW5tS2pJQlg5ckloaUhsbHAvYnpNcElKdGFaQXN2eDNVSFJkR1BzazRxdk5OMUExSWdpOEtEMUdmNW9LM1FiYU5BN2RsZWVrZzRBK0dhUmhTMHkiLCJtYWMiOiJjNmZlZWZkMGVhYmYwYmI1NzgxMTMyZWJiMTNkNTJjNGUzZGNmZmY3NzhmYmUwZWNiZDc0ZDNiZTZhMTdlMjViIiwidGFnIjoiIn0="
    }
    res = requests.get(
        "https://vrdistribution.com.au/search?q=" + game, headers=headers
    )

    # 从这里开始粘贴
    soup = BeautifulSoup(res.text, "lxml")
    product_box_soup = soup.find("div", {"class": "product-box"})
    ret = {"status": "Not Found", "barcode": "", "date": ""}
    if product_box_soup is not None:
        basic_info = product_box_soup.find("div", {"class": "col-xs-7"}).get_text()
        barcode = basic_info.split("Barcode\n")[1].split("\n")[0]
        num_on = "0"

        # 这里解决available数量的问题
        try:
            if "Pre-Order" in basic_info:
                num_on = "0"
            else:
                if "Shipments" in basic_info:
                    date = basic_info.split("Upcoming Shipments")[1].strip()
                else:
                    date = basic_info.split("Upcoming Shipment")[1].strip()
                filter_break = [
                    a.strip() for a in date.split("\n") if a != "" and "(" in a
                ]
                num_on = filter_break[-1]
                num_on = num_on.split("(")[1].strip()
                num_on = num_on.split("Ava")[0].strip()
        except IndexError:
            num_on = "0"

        # 这里解决到货日期的问题
        try:
            if "Pre-Order" in basic_info:
                date = basic_info.split("Release Date")[1].split("estimated")[0].strip()
            else:
                if "Shipments" in basic_info:
                    date = basic_info.split("Upcoming Shipments")[1].strip()
                else:
                    date = basic_info.split("Upcoming Shipment")[1].strip()

                # 用于解决下面的奇葩日期格式
                original_date_str = date

                filter_break = [
                    a.strip() for a in date.split("\n") if a != "" and "(" not in a
                ]
                date = filter_break[-1]

                if "in" in date:
                    date = date.split("in")[1]
                elif "on" in date:
                    date = date.split("on")[1]
                date = date.strip()

                # 网站预测日期有各种奇葩格式，需要逐个解决，如
                # 24 on 7th Dec 2022
                # 24 in Jan 2023 (Estimated)

                if date.strip() == "":
                    if (
                        "2022" in original_date_str
                        or "2023" in original_date_str
                        or "2024" in original_date_str
                    ):
                        if "on" in original_date_str:
                            date = (
                                original_date_str.split("on")[1].strip().split("\n")[0]
                            )
                        if "in" in original_date_str:
                            date = (
                                original_date_str.split("in")[1].strip().split("\n")[0]
                            )
                        date = date.replace("(Estimated)", "").strip()
        except IndexError:
            date = ""
        status_soup = product_box_soup.find("div", {"class": "stock-status-container"})
        status = status_soup.getText().strip()
        num_on = num_on.replace("+", "")
        if int(num_on) < 10:
            num_on = "0" + num_on
        ret = {"status": status, "barcode": barcode, "date": date, "num_on": num_on}
    # 到这里结束

    if outside is True:
        return ret
    else:
        return ret


@app.route("/check-game/<game>")
def check_game(game, outside=True):
    vr_result = check_vr(game, outside)
    if (
        "Arriving" in vr_result["status"]
        or "Order Now" in vr_result["status"]
        or "Not Found" in vr_result["status"]
    ):
        vr_result["status"] += " | " + check_lpg(game)
    return jsonify(vr_result)


@app.route("/bulk-check-game", methods=["POST"])
def bulk_check_game():
    skus = str(request.data, "utf-8").split(",")
    ret = []
    for sku in skus:
        if "+" in sku:
            sku = sku.split("sku")[-1]
        result = check_game(sku, False)
        ret.append(result)
    return jsonify(ret)


@app.route("/staples", methods=["get"])
def get_staples_info():
    return mask.get_info()


@app.route("/my-ip", methods=["get"])
def get_my_ip():
    return request.remote_addr


app.run(host="0.0.0.0", port=3210, debug=True)
