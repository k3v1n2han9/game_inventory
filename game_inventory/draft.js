// ==UserScript==
// @name         game_inventory
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://admin.shopify.com/store/boardgame-master/*
// @grant        none
// ==/UserScript==

let in_inventory_page = location.href.includes('admin/products/inventory');
let in_batch_editing_page = location.href.includes('admin/bulk');
let in_product_page = location.href.includes('admin/products') && !in_inventory_page;

function refreshData() {

    // 不同的页面路径写在这里
    let in_inventory_page = location.href.includes('admin.shopify.com/store/boardgame-master/products/inventory');
    let in_batch_editing_page = location.href.includes('admin.shopify.com/store/boardgame-master/bulk');
    let in_product_page = location.href.includes('admin.shopify.com/store/boardgame-master/products') && !in_inventory_page;


    let api_url = 'https://game.kevinzhang.info/check-game/';
    console.log('refresh');

    // 如果在批量修改页面
    if (in_batch_editing_page) {
        console.log('批量修改页面');
        setTimeout(() => {
            $('.spreadsheet__row').each(function () {
                let self = $(this);
                let sku = self.find('#product_variant_sku').val();
                console.log(sku);
                if (sku) {
                    let xhttp = new XMLHttpRequest();
                    xhttp.onreadystatechange = function () {
                        if (this.readyState === 4 && this.status === 200) {
                            let result = JSON.parse(this.response);
                            let tail = self.find('.variant-option-value');
                            let tail_html = tail.html();
                            if (result.price) {
                                tail_html += '<span style="color:blue">($' + result.price + ')</span>';
                                tail.html(tail_html);
                            } else {
                                tail_html += '<span style="color:red">(' + result.status + ')</span>';
                                tail.html(tail_html);
                            }
                        }
                    };
                    let url = api_url + sku;
                    url = encodeURI(url);
                    xhttp.open("GET", url, true);
                    xhttp.send();
                }
            });
        }, 2000);
    }
    // 如果是在库存主界面
    else if (in_inventory_page) {
        console.log('库存主页面');

        // 删除原有的产品库存状态
        let inventory_status = document.getElementsByClassName('inventory-status');
        for (let i = 0; i < inventory_status.length; i++) {
            inventory_status[i].style.display = 'none';
        }

        // sku的element
        let sku_elems = document.getElementsByClassName('__mHr');

        // 存进去array
        let skus = [];
        for (let i = 0; i < sku_elems.length; i++) {
            skus.push({
                elem: sku_elems[i],
                sku_with_plus: sku_elems[i].innerText
            });
        }

        // 如果sku里面有加号，则发request之前截取加号后面的内容
        skus.forEach(sku_obj => {
            let sku = sku_obj['sku_with_plus'];
            if (sku.includes('+')) {
                let sku_arr = sku.split('+');
                sku = sku_arr[sku_arr.length - 1];
            }
            sku_obj['sku'] = sku;
            sendRequest(sku_obj['sku']);
        });

        function sendRequest(sku) {
            console.log('发送请求');
            let xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function () {
                if (this.readyState === 4 && this.status === 200) {
                    let result = JSON.parse(this.response);

                    // 成功获取之后，找出那个sku，在后面加上状态
                    let target = skus.find(s => s.sku === sku);

                    // order now的就标蓝色，不然就标红色加粗
                    let style = 'color:blue';
                    if (result['status'] !== 'Order Now') {
                        style = 'color:red;font-weight:bold';
                    }
                    target['elem'].innerHTML += '' +
                        '<br>' +
                        '<span class="inventory-status" style="' + style + '"> (' +
                        result['status'] +
                        ')</span>';
                }
            };
            let url = api_url + sku;
            url = encodeURI(url);
            xhttp.open("GET", url, true);
            xhttp.send();
        }
    }
    // 如果是在具体的产品页
    else {
        console.log('产品页');

        // 产品测试url https://admin.shopify.com/store/boardgame-master/products/4746753245247

        let title_elem = document.getElementsByClassName('Polaris-Header-Title_2qj8j')[0];
        let title_container_elem = document.getElementsByClassName('Polaris-Page-Header__TitleWrapper_bejfn')[0];
        let game_title = title_elem.innerText;
        let sku = document.getElementById('InventoryCardSku').value;
        if (sku.includes('+')) {
            sku = sku.split('+');
            sku = sku[sku.length - 1];
        }
        let xhttp = new XMLHttpRequest();
        xhttp.onreadystatechange = function () {
            if (this.readyState === 4 && this.status === 200) {
                let ret = JSON.parse(this.response);
                let status = ret.status;

                // title上标明状态，以及供应商的产品链接
                title_container_elem.innerHTML += '' +
                    '<h1>' +
                    '<span style="color:red">(' + ret.status + ')</span>' +
                    '<br>' +
                    '<a target="_blank" href="https://vrdistribution.com.au/search?q=' + sku + '">' +
                    '供应商网站（VR）' +
                    '<br>' +
                    '<a target="_blank" href="https://letsplaygames.com.au/catalogsearch/result/?q=' + sku + '">' +
                    '供应商网站（Let\'s Play）' +
                    '</a>' +
                    '</h1>';

                // 修改：标题input box
                let title_label = document.getElementsByClassName('Polaris-Labelled__LabelWrapper_bf6ys')[0];

                // 修改：collection
                let collection_label = document.getElementById('CollectionsAutocompleteField1Label');

                // 修改：sku
                let sku_label = document.getElementById('InventoryCardSkuLabel');

                // 修改：available
                // let available_label = document.getElementById('AdjustQuantityPopoverTextFieldActivatorLabel');

                // 修改：description
                let game_description_label = document.getElementById('product-descriptionLabel');

                // shopify 经常改版，此功能用于debug哪个label改名字了
                [
                    {name: 'title', elem: title_label},
                    {name: 'collection', elem: collection_label},
                    {name: 'sku', elem: sku_label},
                    {name: 'description', elem: game_description_label},
                ]
                    .forEach(item => {
                        if (!item.elem) {
                            console.log(item.name, '坏了');
                        }
                    });
                if (status.includes('Arriving Soon') || status.includes('Pre Order')) {
                    title_label.innerHTML += mergeString(`<a href="javascript:copyText('【Pre-Order】')">复制</a>`, {game_title});
                    collection_label.innerHTML += `<br><a href="javascript:copyText('Pre-Order')">复制Pre-Order</a>`;
                    if (status === 'Pre Order') {
                        collection_label.innerHTML += `<br><a href="javascript:copyText('Early Bird Discount')">复制Early Bird Discount</a>`;
                    }
                    // available_label.innerHTML = `<a href="javascript:copyText('2')">复制</a>`;
                    let date_arr = ret['date'].split(' ').filter(a => a);
                    let day = '';

                    let arrival_message;

                    // 如果有具体的到货日期
                    if (date_arr.length === 3) {

                        // 去掉后面两个字母 st, nd, rd, th等
                        day = date_arr[0].substring(0, date_arr[0].length - 2);
                        arrival_message = `<p> <strong> Please read our pre-order policy at the foot of the webpage before ordering (It is important when you want the order sent separately). </strong></p><p> <span style="color: rgb(255, 0, 0);" data-mce-style="color: #ff0000;"> <strong> Please be aware that the following product is a pre-order and is expected to be released/(Re)stocked in&nbsp;{{arrival}}. </strong> </span></p><p> <span style="color: rgb(255, 0, 0);" data-mce-style="color: #ff0000;"> <strong> As our supplier hasn’t provided a detailed release/restock date, so it is likely to delay. Thus, we strongly recommend you to order this item separately with all other items to avoid the possible late dispatch of the whole order. </strong> </span></p><br><br><br><br>`;
                    }
                    // 如果没有具体的到货日期
                    else {
                        arrival_message = `<p> <strong> Please read our pre-order policy at the foot of the webpage before ordering (It is important when you want the order sent separately). </strong></p><p> <span style="color: rgb(255, 0, 0);" data-mce-style="color: #ff0000;"> <strong> Please be aware that the following product is a pre-order and is expected to be released/(Re)stocked in&nbsp;{{arrival}}. </strong> </span></p><p> <span style="color: rgb(255, 0, 0);" data-mce-style="color: #ff0000;"> <strong> As our supplier hasn’t provided a detailed release/restock date, so it is likely to delay. Thus, we strongly recommend you to order this item separately with all other items to avoid the possible late dispatch of the whole order. </strong> </span></p><br><br><br><br>`;
                    }

                    let month_str = [
                        '',
                        "Jan",
                        "Feb",
                        "Mar",
                        "Apr",
                        "May",
                        "Jun",
                        "Jul",
                        "Aug",
                        "Sep",
                        "Oct",
                        "Nov",
                        "Dec",
                    ];
                    let month_str_full = [
                        '',
                        "January",
                        "February",
                        "March",
                        "April",
                        "May",
                        "June",
                        "July",
                        "August",
                        "September",
                        "October",
                        "November",
                        "December",
                    ];
                    let month = month_str.indexOf(date_arr[date_arr.length - 2]);
                    if (Number(month) < 10) {
                        month = '0' + month;
                    }
                    if (day && Number(day) < 10) {
                        day = '0' + day;
                    }
                    let new_sku, arrival;
                    if (day) {
                        arrival = new Date(
                            new Date(
                                date_arr[date_arr.length - 1] + '-' + month + '-' + day + ' 00:00:00'
                            ).getTime() + 86400000 * 28
                        );
                        new_sku = '9999' + month + day + ret['num_on'];
                        arrival = arrival.getDate() + ' ' + month_str_full[arrival.getMonth() + 1] + ' ' + arrival.getFullYear();
                    } else if (date_arr.length === 0) { // 没有具体到货日的
                        arrival = '(unknown)'
                    } else { // 到货日只显示到月，没显示日的
                        arrival = month_str_full[month_str.indexOf(date_arr[0])] + '&nbsp;' + date_arr[1].substring(0, 4);

                        // 按照需求，这里的月份要+一个月
                        let next_month = new Date(new Date(arrival).getTime() + 86400000 * 32);
                        next_month = month_str_full[next_month.getMonth() + 1] + ' ' + next_month.getFullYear();
                        arrival = next_month;
                    }
                    new_sku += '+';
                    sku_label.innerHTML += mergeString(`<a href="javascript:copyText('{{new_sku}}')">复制</a>`, {new_sku});
                    let prepend_html = mergeString(arrival_message, {arrival});
                    game_description_label.innerHTML += '<br>手动复制粘贴以下内容<br><div style="background-color: lightgray">' + prepend_html + '</div>';
                }
            }
        };
        let url = api_url + sku;
        url = encodeURI(url);
        xhttp.open("GET", url, true);
        xhttp.send();
    }
}

// 不同页面的刷新按钮（按大标题刷新）
let is_loading = false;
let loading_icon_count = -1;
let interval = setInterval(() => {
    let elem = document.getElementsByClassName('Polaris-Header-Title'); // 库存主页面刷新按钮
    // let elem2 = document.getElementsByClassName('ui-title-bar__title'); // 产品页刷新按钮
    if (elem.length > 0) {
        elem = elem[0];
        elem.removeEventListener('click', refreshData);
        elem.addEventListener('click', refreshData);
    }
    // if (elem2.length > 0) {
    //     elem2 = elem2[0];
    //     elem2.removeEventListener('click', refreshData);
    //     elem2.addEventListener('click', refreshData);
    // }
}, 1000);


function mergeString(str, json) {
    while (str.includes('{{')) {
        let key_name = str.split('{{')[1].split('}}')[0];
        str = str.replace('{{' + key_name + '}}', json[key_name]);
    }
    return str;
}

function copyText(text) {
    let virtual_input = document.createElement('input');
    virtual_input.style.transform = 'scale(0.1)';
    document.body.appendChild(virtual_input);
    virtual_input.value = text;
    virtual_input.select();
    virtual_input.setSelectionRange(0, 99999);
    document.execCommand("copy");
    document.body.removeChild(virtual_input);
}

let s1 = document.createElement('script');
s1.appendChild(document.createTextNode(copyText));
(document.body || document.head || document.documentElement).appendChild(s1);

let s2 = document.createElement('script');
s2.appendChild(document.createTextNode(mergeString));
(document.body || document.head || document.documentElement).appendChild(s2);

let s3 = document.createElement('script');
s3.appendChild(document.createTextNode(refreshData));
(document.body || document.head || document.documentElement).appendChild(s3);

