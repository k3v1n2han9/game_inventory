from bs4 import BeautifulSoup

web_source_file = open("./web_source2.txt", "r")
web_source = web_source_file.read()

all_soup = BeautifulSoup(web_source, "lxml")

backorder_soup = all_soup.find("div", class_="eta-wrapper")
ret = ""
if backorder_soup:
    ret = backorder_soup.get_text()
else:
    ret = "not found"
print(ret)
