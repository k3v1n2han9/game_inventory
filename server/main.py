import re
import json
import requests
import traceback
from flask_cors import CORS
from bs4 import BeautifulSoup
from flask import Flask, jsonify, request

app = Flask(__name__)
CORS(app)


@app.route("/")
def hello_world():
    return "Hello, Amazon!"


def check_lpg(game_code):
    """
    该函数会向 letsplaygames (LPG) 的某个 Algolia 搜索接口发送 POST 请求，
    根据指定的 game_code 搜索对应的游戏产品信息，并返回其库存或可用状态。

    :param game_code: str，游戏代码或关键字（用于搜索）
    :return: str，返回形如 "In Stock (stock qty 15)" 的可用状态描述；如果没找到或出错则返回 "not found"
    """

    # 目标 URL，实际指向了 Algolia 的索引查询接口
    url = (
        "https://pb90nuup1o-dsn.algolia.net/1/indexes/*/queries"
        "?x-algolia-agent=Algolia%20for%20JavaScript%20(3.35.1)%3B%20Browser%3B%20Magento2%20integration%20(3.7.0)%3B%20autocomplete.js%200.38.1"
        "&x-algolia-application-id=PB90NUUP1O"
        "&x-algolia-api-key=NzhhN2Y1ZGExOGFjYzU3MDViYTVkY2JmMDhmNGQzNGJkOGYyYzI2YmI0ZjVjZjkyODViMGE2ODU5NzAyNDBkMHRhZ0ZpbHRlcnM9"
    )

    # 常规请求头，模拟来自浏览器的访问
    headers = {
        "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,zh-TW;q=0.6",
        "Connection": "keep-alive",
        "DNT": "1",
        "Origin": "https://letsplaygames.com.au",
        "Referer": "https://letsplaygames.com.au/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "cross-site",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        "accept": "application/json",
        "content-type": "application/x-www-form-urlencoded",
        "sec-ch-ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
    }

    # 构造请求体，分别查询 categories、products、pages 三个索引
    data = {
        "requests": [
            {
                "indexName": "lpg_production_lpg_categories",
                "params": (
                    f"query={game_code}&hitsPerPage=3&analyticsTags=autocomplete&clickAnalytics=true"
                ),
            },
            {
                "indexName": "lpg_production_lpg_products",
                "params": (
                    f"query={game_code}&hitsPerPage=8&analyticsTags=autocomplete&clickAnalytics=true"
                    "&facets=%5B%22categories.level0%22%5D&numericFilters=visibility_search%3D1"
                    "&ruleContexts=%5B%22magento_filters%22%2C%22%22%5D"
                ),
            },
            {
                "indexName": "lpg_production_lpg_pages",
                "params": (
                    f"query={game_code}&hitsPerPage=2&analyticsTags=autocomplete&clickAnalytics=true"
                ),
            },
        ]
    }

    try:
        # 尝试向目标接口发送 POST 请求
        response = requests.post(url, headers=headers, json=data)
    except requests.exceptions.RequestException as e:
        # 如果网络请求本身出错，比如超时、DNS 解析失败等，则打印错误信息并返回
        print(f"[check_lpg] Request exception occurred: {e}")
        return "not found"

    # 如果服务器返回了状态码 200，说明请求成功
    if response.status_code == 200:
        try:
            # 尝试解析返回的 JSON
            result = response.json()
        except json.JSONDecodeError as e:
            # 如果 JSON 解析失败，则返回
            print(f"[check_lpg] JSON parse error: {e}")
            return "not found"

        # 从返回结果中查找 lpg_production_lpg_products 索引
        for res_item in result.get("results", []):
            # 只关心 products 索引
            if res_item.get("index") == "lpg_production_lpg_products":
                # 在 hits 中获取产品信息
                hits = res_item.get("hits", [])
                if hits:
                    # 只取第一个匹配项（假设第一个就是我们想要的）
                    first_hit = hits[0]
                    # 获取 gg_availability 字段，如果不存在则默认 "Unknown"
                    gg_availability = first_hit.get("gg_availability", "Unknown")
                    # 获取 stock_qty 字段，如果不存在则默认为 0
                    stock_qty = first_hit.get("stock_qty", 0)
                    return f"{gg_availability} (stock qty {stock_qty})"
                else:
                    # 如果没有找到任何产品，返回 not found
                    return "not found"

        # 如果循环结束仍未返回，说明没找到想要的内容
        return "not found"

    else:
        # 如果 HTTP 状态码不是 200，则打印并返回 not found
        print(f"[check_lpg] Request failed with status code {response.status_code}")
        return "not found"


def check_vr(game):
    """
    该函数用于访问 VR Distribution 网站，根据 game 关键字搜索产品信息，并解析产品盒区中的
    产品状态、条形码、到货日期以及可用数量等信息。

    :param game:      需要搜索的游戏名称（或关键词）
    :return:          字典形式的产品信息，包括:
                      {
                          "status":   库存状态,
                          "barcode":  条形码,
                          "date":     到货日期,
                          "num_on":   当前/预计可用数量
                      }
                      如果没有找到产品则返回
                      {
                          "status": "Not Found",
                          "barcode": "",
                          "date": "",
                          "num_on": ""
                      }
    """

    # 这里设置了一些访问 VR Distribution 网站需要的请求头或 Cookie 等信息
    headers = {
        "cookie": "didomi_token=eyJ1c2VyX2lkIjoiMTk3Y2M0ZGEtNTc3NS02OGE1LThiZDItMDk3ODZmMmJhZmUyIiwiY3JlYXRlZCI6IjIwMjUtMDctMDJUMTg6MDI6MTAuMTY3WiIsInVwZGF0ZWQiOiIyMDI1LTA3LTAyVDE4OjAyOjEwLjE2OFoiLCJ2ZXJzaW9uIjpudWxsfQ==; remember_web_59ba36addc2b2f9401580f014c7f58ea4e30989d=eyJpdiI6Ii9XNy9GZWUwaHEwUlZ6TmJaOTZmMWc9PSIsInZhbHVlIjoiV0ZqRWVUaFZuSk92TVErR1FXb281U3lIUXdadlh3dlNpbEgwYkh5eHZ2L1ZuUEZQSENLNFBkaG51SG5yb0ZyRUlpMTByMTR1dXZqd0dNN3h2WHlFMWliT2RkQnkyN3hjNmJ0SlZZTXhOaU9IZXJmcmFDTTkwYVBJeTZ6VStPRG1LSDZ1Z282NllwUHRMcEprSk1qMmN1eGxydDY2Z0lwTlFMYmxjS2FORHFWNEI5TjB4L01lVkJjcVRJS0s5aC9Fa3FoOFdzOUFQbDhEdFdQVVBvcWF0aFR1cmJldHBUb2x5aFYySGtibmI4UT0iLCJtYWMiOiI3NGNiNDNlOWFjMzc3MzA3ZmVmNzA5ZjcxOTJkOThlNDI2YTE0ZjRjYzg5M2YzNTA4NDJlM2QyMmE4YjEwMjhmIiwidGFnIjoiIn0%3D; AWSALB=n8Ltjzvw2IcrcY4crHwMfRZ5CBA3JBfLfxdkJZ+Wv4vrNZyUDbJoKuYTUbdFZ5cf6IPC85WBABOlFQ8lJjPbt1qir5SfLC3CUNkq/9WiwmK8Au9dcmCwiFrnKuID; AWSALBCORS=n8Ltjzvw2IcrcY4crHwMfRZ5CBA3JBfLfxdkJZ+Wv4vrNZyUDbJoKuYTUbdFZ5cf6IPC85WBABOlFQ8lJjPbt1qir5SfLC3CUNkq/9WiwmK8Au9dcmCwiFrnKuID; itemsPerPage=eyJpdiI6IkZORUZWWEhPWmV1Kyt6TkRWT3lDZ2c9PSIsInZhbHVlIjoiclBDNHd2MkhNamZleERLSWdIK2ZrczcrcXdRRCs2RXdUdk5IUDNUSzlsRks3Y2pxSnRuOXl3Sk42eEUySm1KNyIsIm1hYyI6IjdiZTE0YjVkZDYzNzU5ZmE4MzczOGUwNmNkYzY0ZWIxNDhhMTAwNjRiZTI2NDNiMzY5MTkyOTI1YTllYTQ1ZTUiLCJ0YWciOiIifQ%3D%3D; XSRF-TOKEN=eyJpdiI6IjRwU3JzTktxVm5NMU1sdEhodFFhZ3c9PSIsInZhbHVlIjoidlc0NWZ0c3p1RGpZTi9pWE4zM3pkQnoyb2pMM2RFQ3lSK3ltbS9oY054M01nWDR5VmJPNUE5SzJnY05ubWpKdGplUlNYWTdjZWhHVVRIcUJocFd5YmlZbXRnQzNIUHdSWXRacUN1T3Z1bjRMUWt1c2s2cEFqQU5vT0hCOUdxODUiLCJtYWMiOiJmNWY2MGU5ZTZmMjliZjdjMzQyMDM4ZDgwODQ5OGNmMzUwNTBhNWRkYTQzZDg0NzRjZjUwOWFjNmI1OGIzODg1IiwidGFnIjoiIn0%3D; vr=eyJpdiI6ImJpM1prMFdoR2JwZlJ5M0ZVdHpoaHc9PSIsInZhbHVlIjoid0c5RVlTaUdxYWhwSFNMZ2pCdTIreC9OQkIwK1h1cDd1SUV6VVpoNHNwM0NJMS9EU3EzMEtDSzh4TUhnRVN0RC9Cb1NYdE5NUHJXMis3bEZ1WWIrUWZYUm5hRWVPd28rQ3N4L0NBVW52cEk0ck93VDd2R2VaUW5BbVd6djVUek8iLCJtYWMiOiJjZTVhOGZmOGM1NmE0YjdhZDgwNzc4YzdmY2M3NDRjYTU4ZjcwNjI2ZGFiNGZiYzUxZGU3YzZkZjJkMzY1MzNjIiwidGFnIjoiIn0%3D"
    }

    # 向 VR Distribution 发起搜索请求
    res = requests.get(
        "https://vrdistribution.com.au/search?q=" + game, headers=headers
    )

    # 用 BeautifulSoup 解析返回的 HTML
    soup = BeautifulSoup(res.text, "lxml")

    # 查找产品盒区域（通常包含了产品的主要信息）
    product_box_soup = soup.find("div", {"class": "product-box"})

    # 先预设一个默认返回结果，表示未找到产品
    ret = {"status": "Not Found", "barcode": "", "date": "", "num_on": ""}

    if product_box_soup is not None:
        # 产品盒区域解析
        basic_info = product_box_soup.find("div", {"class": "col-xs-7"}).get_text()

        # 获取 Barcode（条形码）
        barcode = basic_info.split("Barcode\n")[1].split("\n")[0]

        # 首先默认库存数量为 0
        num_on = "0"

        # -- 1. 解析库存数量 --
        try:
            # 如果在文本中找到 "Pre-Order"，则默认认为现货/可用数量为 0
            if "Pre-Order" in basic_info:
                num_on = "0"
            else:
                # 先通过 "Upcoming Shipments" 或 "Upcoming Shipment" 来拆分
                if "Shipments" in basic_info:
                    date_section = basic_info.split("Upcoming Shipments")[1].strip()
                else:
                    date_section = basic_info.split("Upcoming Shipment")[1].strip()

                # date_section 里往往包含多行，利用换行符分割
                # 在包含 "(" 的行里，一般能找到库存相关信息，比如 "24 (Available)"
                lines_with_parentheses = [
                    a.strip() for a in date_section.split("\n") if a != "" and "(" in a
                ]
                # 获取最后一行，以应对多个 shipment 的情况
                num_on_str = lines_with_parentheses[-1]
                # 从 "24 (Available)" 中把 "24" 提取出来
                num_on_str = num_on_str.split("(")[1].strip()  # Available)
                num_on_str = num_on_str.split("Ava")[0].strip()  # 只剩下数字
                num_on = num_on_str
        except IndexError:
            # 如果解析出错，就默认为 0
            num_on = "0"

        # -- 2. 解析到货日期 --
        try:
            # 如果在文本中找到 "Pre-Order"，则到货日期通过 Release Date 去拆分
            if "Pre-Order" in basic_info:
                date = basic_info.split("Release Date")[1].split("estimated")[0].strip()
            else:
                # 先通过 "Upcoming Shipments" 或 "Upcoming Shipment" 来分割
                if "Shipments" in basic_info:
                    date = basic_info.split("Upcoming Shipments")[1].strip()
                else:
                    date = basic_info.split("Upcoming Shipment")[1].strip()

                # original_date_str 用来保存最初的拆分片段，可能带有多行或者“on/in”前缀
                original_date_str = date

                # 1) 先去掉每行里包含 "(" 的行，例如 "...(Estimated)" 之类的，以防干扰
                filter_break = [
                    a.strip() for a in date.split("\n") if a != "" and "(" not in a
                ]
                # 2) 取最后一行作为候选日期字符串
                date = filter_break[-1] if len(filter_break) > 0 else ""

                # 3) 根据常见格式 "in" 或 "on" 来进一步截取
                #    例如 "24 in Jan 2023" 或 "24 on 7th Dec 2023"
                if "in" in date:
                    date = date.split("in")[1]
                elif "on" in date:
                    date = date.split("on")[1]
                date = date.strip()

                # 如果以上步骤后还是空串，说明 date 的获取还需要从 original_date_str 中提取
                if not date:
                    # 利用正则搜索是否含有 4 位年份（19xx 或 20xx）
                    # 这样将来如果是 2029 或者 2035 之类的也能匹配到
                    year_pattern = re.compile(r"(19|20)\d{2}")
                    year_match = year_pattern.search(original_date_str)

                    # 如果找到了年份，则可能意味着 original_date_str 中有可用信息
                    if year_match:
                        # 例如 original_date_str = "24 in Jan 2025 (Estimated)"
                        #    original_date_str = "24 on 7th Dec 2025"
                        # 我们尝试找 "on" 或 "in" 后续的部分
                        # 如果想处理得更全面，可以直接用复杂正则，但这里就保持相对简单
                        # 1) 先剥离 (Estimated)
                        cleaned_str = original_date_str.replace(
                            "(Estimated)", ""
                        ).strip()

                        # 2) 再看 "on" 或 "in"
                        #    例如 "24 on 7th Dec 2025"
                        if " on " in cleaned_str:
                            date_after_on = cleaned_str.split(" on ")[1]
                            date = date_after_on.split("\n")[0].strip()
                        elif " in " in cleaned_str:
                            date_after_in = cleaned_str.split(" in ")[1]
                            date = date_after_in.split("\n")[0].strip()

        except IndexError:
            date = ""

        # -- 3. 解析商品状态（如 "In stock"、"Out of stock" 等） --
        status_soup = product_box_soup.find("div", {"class": "stock-status-container"})
        if status_soup:
            status = status_soup.get_text().strip()
        else:
            status = "Not Found"

        # -- 4. 对库存数量进行简单处理，比如如果数量小于 10，就补 0 前缀 --
        num_on = num_on.replace("+", "")
        if num_on.isdigit() and int(num_on) < 10:
            num_on = "0" + num_on

        # 组装最终结果
        ret = {"status": status, "barcode": barcode, "date": date, "num_on": num_on}

    return ret


def check_game(game, return_json=True):
    """
    该函数会先调用 check_vr(game) 获取 VR Distribution 上对该游戏的查询结果。
    如果 VR 的结果状态字符串中包含了 "Arriving"、"Order Now" 或 "Not Found"，
    则再调用 check_lpg(game)，并将结果拼接到 VR 结果的 status 字段后面。

    :param game: str, 游戏关键字或 SKU
    :param return_json: bool, 为 True 时返回 Flask 的 jsonify 对象；否则返回原始字典
    :return: 如果 return_json=True，返回 jsonify(vr_result)；否则返回 vr_result 字典
    """
    try:
        # 假设 check_vr 返回类似 {"status": "...", ...} 的字典
        vr_result = check_vr(game)
    except Exception as e:
        # 如果 check_vr 出错，这里可以记录一下日志
        traceback.print_exc()
        vr_result = {"status": "Not Found", "error": str(e)}

    # 如果 VR 结果中包含 Arriving / Order Now / Not Found，则再次调用 check_lpg
    if (
        "Arriving" in vr_result["status"]
        or "Order Now" in vr_result["status"]
        or "Not Found" in vr_result["status"]
    ):
        try:
            # 假设 check_lpg(game) 返回类似 "In Stock (stock qty 15)" 或 "not found"
            lpg_result = check_lpg(game)
            vr_result["status"] += f" | {lpg_result}"
        except Exception as e:
            traceback.print_exc()
            vr_result["status"] += " | not found"
            vr_result["error"] = str(e)

    # 根据 return_json 参数决定返回类型
    if return_json:
        return jsonify(vr_result)
    else:
        return vr_result


@app.route("/check-game/<game>")
def check_game_route(game):
    """
    路由函数：直接通过 URL 访问时，使用 game 作为参数调用 check_game，并返回 JSON 化结果。
    例如访问: http://<host:port>/check-game/xxxx
    """
    return check_game(game, return_json=True)


@app.route("/bulk-check-game", methods=["POST"])
def bulk_check_game():
    """
    路由函数：用于批量查询多个游戏 SKU (或 game 关键字)。
    前端可以通过 POST 方法提交一个包含若干 SKU 串的请求，每个 SKU 之间用逗号分隔。
    例如： "SKU001,SKU002,SKU003"
    函数会逐个调用 check_game 并收集结果后返回。
    """
    try:
        # 获取原始的 POST 数据，并解析出每个 SKU（用逗号分隔）
        skus = str(request.data, "utf-8").split(",")
    except Exception:
        traceback.print_exc()
        return jsonify({"error": "invalid input data"}), 400

    ret = []
    for sku in skus:
        # 处理包含 "+" 以及 "sku" 的情况
        if "+" in sku:
            sku = sku.split("sku")[-1]

        # 这里调用 check_game，并指定 return_json=False 来获取原始字典结果
        result = check_game(sku, return_json=False)
        ret.append(result)

    return jsonify(ret)


@app.route("/my-ip", methods=["GET"])
def get_my_ip():
    """
    路由函数：返回访问者的 IP 地址。
    """
    return request.remote_addr


app.run(host="0.0.0.0", port=3210, debug=True)
