// ==UserScript==
// @name         game_inventory
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       You
// @match        https://admin.shopify.com/store/boardgame-master/*
// @grant        none
// ==/UserScript==

/**
 * 检查当前页面 URL 判断所在页面类型
 */
const getPageType = () => {
    const url = location.href;
    const inInventoryPage = url.includes('admin.shopify.com/store/boardgame-master/products/inventory');
    const inBatchEditingPage = url.includes('admin.shopify.com/store/boardgame-master/bulk');
    // 产品页不包含库存页面
    const inProductPage = url.includes('admin.shopify.com/store/boardgame-master/products') && !inInventoryPage;
    return { inInventoryPage, inBatchEditingPage, inProductPage };
  };
  
  /**
   * 用于模板字符串的占位符替换，比如将 "Hello {{name}}" 中的 {{name}} 替换为传入 json 对象中的 name 属性
   * @param {string} template 模板字符串
   * @param {Object} values 对应的键值对
   * @returns {string} 替换后的字符串
   */
  const mergeString = (template, values) => {
    // 当模板中还有占位符时循环替换
    while (template.includes('{{')) {
      const key = template.split('{{')[1].split('}}')[0];
      template = template.replace(`{{${key}}}`, values[key]);
    }
    return template;
  };
  
  /**
   * 复制文本到剪贴板
   * @param {string} text 要复制的文本
   */
  const copyText = (text) => {
    const virtualInput = document.createElement('input');
    virtualInput.style.transform = 'scale(0.1)';
    document.body.appendChild(virtualInput);
    virtualInput.value = text;
    virtualInput.select();
    virtualInput.setSelectionRange(0, 99999);
    document.execCommand('copy');
    document.body.removeChild(virtualInput);
  };
  
  /**
   * 发送 GET 请求到 API，并解析返回的 JSON
   * @param {string} sku 产品 SKU
   * @returns {Promise<Object>} 返回一个 Promise，解析后的 JSON 数据
   */
  const fetchDataBySku = (sku) => {
    const apiUrl = 'https://game.kevinzhang.info/check-game/';
    const url = encodeURI(apiUrl + sku);
    return fetch(url).then(response => {
      if (!response.ok) {
        throw new Error(`Network response was not ok, status: ${response.status}`);
      }
      return response.json();
    });
  };
  
  /**
   * 批量修改页面逻辑处理：
   * 遍历所有行，提取 SKU 后发起请求，
   * 根据返回结果在对应行追加价格或状态提示。
   */
  const handleBatchEditingPage = () => {
    console.log('当前为批量修改页面');
    // 延时2秒等待页面元素加载完成
    setTimeout(() => {
      // 遍历每一行
      $('.spreadsheet__row').each(function () {
        const $row = $(this);
        const sku = $row.find('#product_variant_sku').val();
        if (sku) {
          fetchDataBySku(sku)
            .then(result => {
              const tailElem = $row.find('.variant-option-value');
              let tailHTML = tailElem.html();
              // 如果有价格则标蓝，否则标红
              if (result.price) {
                tailHTML += `<span style="color:blue">($${result.price})</span>`;
              } else {
                tailHTML += `<span style="color:red">(${result.status})</span>`;
              }
              tailElem.html(tailHTML);
            })
            .catch(error => console.error(`Error fetching SKU ${sku}:`, error));
        }
      });
    }, 2000);
  };
  
  /**
   * 库存主页面逻辑处理：
   * 隐藏原有库存状态，对每个 SKU 发起请求，然后在对应位置追加状态提示
   */
  const handleInventoryPage = () => {
    console.log('当前为库存主页面');
  
    // 隐藏所有已有的库存状态元素
    const inventoryStatusElems = document.getElementsByClassName('inventory-status');
    Array.from(inventoryStatusElems).forEach(elem => elem.style.display = 'none');
  
    // 获取所有显示 SKU 的元素
    const skuElems = document.getElementsByClassName('_Sku_gfy7s_1');
    // 保存 SKU 对应的 DOM 元素及其文本（可能带有 '+' 符号）
    const skuObjects = Array.from(skuElems).map(elem => ({
      elem,
      skuWithPlus: elem.innerText
    }));
  
    skuObjects.forEach(skuObj => {
      // 处理 SKU 中可能带有 '+' 的情况，取最后一个部分
      let { skuWithPlus } = skuObj;
      let sku = skuWithPlus.includes('+') ? skuWithPlus.split('+').pop() : skuWithPlus;
      skuObj.sku = sku;
  
      // 发起请求，并在对应的 SKU 元素后追加状态提示
      fetchDataBySku(sku)
        .then(result => {
          // 查找目标元素
          const target = skuObjects.find(item => item.sku === sku);
          // 根据返回的状态决定样式：如果状态为 "Order Now" 则蓝色，否则红色且加粗
          const style = (result.status === 'Order Now') ? 'color:blue' : 'color:red;font-weight:bold';
          target.elem.innerHTML += `<br><span class="inventory-status" style="${style}"> (${result.status})</span>`;
        })
        .catch(error => console.error(`Error fetching SKU ${sku}:`, error));
    });
  };
  
  /**
   * 具体产品页逻辑处理：
   * 获取页面中的 SKU 与标题元素，
   * 发起请求后根据返回信息在标题上添加状态和供应商链接，
   * 同时对一些 label 做检查，若产品为预购/即将到货则追加复制按钮以及提示信息。
   */
  const handleProductPage = () => {
    console.log('当前为产品页');
  
    // 获取页面主要元素
    const titleElem = document.getElementsByClassName('Polaris-Header-Title')[0];
    const titleContainerElem = document.getElementsByClassName('Polaris-Page-Header__TitleWrapper')[0];
    const gameTitle = titleElem.innerText;
    let sku = document.getElementById('InventoryCardSku').value;
    if (sku.includes('+')) {
      sku = sku.split('+').pop();
    }
  
    fetchDataBySku(sku)
      .then(ret => {
        const status = ret.status;
        // 在标题区域追加状态标识及供应商网站链接
        titleContainerElem.innerHTML += `
          <h1>
            <span style="color:red">(${status})</span>
            <br>
            <a target="_blank" href="https://vrdistribution.com.au/search?q=${sku}">供应商网站（VR）</a>
            <br>
            <a target="_blank" href="https://letsplaygames.com.au/catalogsearch/result/?q=${sku}">供应商网站（Let's Play）</a>
          </h1>
        `;
  
        // 检查各个 label 元素（Shopify 可能更新页面结构，方便调试）
        const titleLabel = document.getElementsByClassName('Polaris-Label__Text')[0];
        const collectionLabel = document.getElementById('CollectionsAutocompleteField1Label');
        const skuLabel = document.getElementById('InventoryCardSkuLabel');
        const gameDescriptionLabel = document.getElementById('product-descriptionLabel');
        [
          { name: 'title', elem: titleLabel },
          { name: 'collection', elem: collectionLabel },
          { name: 'sku', elem: skuLabel },
          { name: 'description', elem: gameDescriptionLabel },
        ].forEach(item => {
          if (!item.elem) {
            console.log(`${item.name} 元素获取失败`);
          }
        });
  
        // 如果状态中包含 "Arriving Soon" 或 "Pre Order"，则追加复制按钮及提示信息
        if (status.includes('Arriving Soon') || status.includes('Pre Order')) {
          // 为标题 label 追加复制按钮，点击后复制预购提示
          titleLabel.innerHTML += mergeString(
            `<a href="javascript:copyText('【Pre-Order】')">复制</a>`,
            { game_title }
          );
          collectionLabel.innerHTML += `<br><a href="javascript:copyText('Pre-Order')">复制Pre-Order</a>`;
          if (status === 'Pre Order') {
            collectionLabel.innerHTML += `<br><a href="javascript:copyText('Early Bird Discount')">复制Early Bird Discount</a>`;
          }
          // available 部分如果需要，可类似处理
  
          // 根据返回的日期处理到货信息
          const dateArr = ret.date.split(' ').filter(a => a);
          let day = '';
          let arrivalMessage = '';
  
          if (dateArr.length === 3) {
            // 当日期中包含具体日份，例如 "21st Mar 2025"
            day = dateArr[0].slice(0, -2); // 去掉 st, nd, rd, th
            arrivalMessage = `<p><strong>Please read our pre-order policy at the foot of the webpage before ordering (It is important when you want the order sent separately).</strong></p>
            <p><span style="color: #ff0000;"><strong>Please be aware that the following product is a pre-order and is expected to be released/(Re)stocked in {{arrival}}.</strong></span></p>
            <p><span style="color: #ff0000;"><strong>As our supplier hasn’t provided a detailed release/restock date, so it is likely to delay. Thus, we strongly recommend you to order this item separately with all other items to avoid the possible late dispatch of the whole order.</strong></span></p><br><br><br><br>`;
          } else {
            // 如果没有具体日份，则使用另一种格式
            arrivalMessage = `<p><strong>Please read our pre-order policy at the foot of the webpage before ordering (It is important when you want the order sent separately).</strong></p>
            <p><span style="color: #ff0000;"><strong>Please be aware that the following product is a pre-order and is expected to be released/(Re)stocked in {{arrival}}.</strong></span></p>
            <p><span style="color: #ff0000;"><strong>As our supplier hasn’t provided a detailed release/restock date, so it is likely to delay. Thus, we strongly recommend you to order this item separately with all other items to avoid the possible late dispatch of the whole order.</strong></span></p><br><br><br><br>`;
          }
  
          // 定义月份简写和全称数组
          const monthStr = ['', "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
          const monthStrFull = ['', "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  
          // 根据日期数据生成新的 SKU 和到货日期（此处逻辑根据原需求做处理）
          let month = monthStr.indexOf(dateArr[dateArr.length - 2]);
          month = month < 10 ? '0' + month : month;
          if (day && Number(day) < 10) {
            day = '0' + day;
          }
          let newSku = '';
          let arrival = '';
          if (day) {
            // 当有具体日份时，新 SKU 拼接方式及到货日期计算（增加28天）
            const arrivalDate = new Date(new Date(`${dateArr[dateArr.length - 1]}-${month}-${day} 00:00:00`).getTime() + 86400000 * 28);
            newSku = '9999' + month + day + ret.num_on;
            arrival = `${arrivalDate.getDate()} ${monthStrFull[arrivalDate.getMonth() + 1]} ${arrivalDate.getFullYear()}`;
          } else if (dateArr.length === 0) {
            // 没有具体到货日期
            arrival = '(unknown)';
          } else {
            // 只有月份信息
            arrival = `${monthStrFull[monthStr.indexOf(dateArr[0])]} ${dateArr[1].substring(0, 4)}`;
            // 按需求加一个月
            const nextMonthDate = new Date(new Date(arrival).getTime() + 86400000 * 32);
            arrival = `${monthStrFull[nextMonthDate.getMonth() + 1]} ${nextMonthDate.getFullYear()}`;
          }
          newSku += '+';
  
          // 为 SKU label 追加复制按钮
          skuLabel.innerHTML += mergeString(`<a href="javascript:copyText('{{newSku}}')">复制</a>`, { newSku });
          // 将到货提示信息替换占位符后追加到产品描述中
          const prependHTML = mergeString(arrivalMessage, { arrival });
          gameDescriptionLabel.innerHTML += `<br>手动复制粘贴以下内容<br><div style="background-color: lightgray">${prependHTML}</div>`;
        }
      })
      .catch(error => console.error(`Error fetching SKU ${sku}:`, error));
  };
  
  /**
   * 主刷新函数，根据当前页面类型执行不同的处理逻辑
   */
  const refreshData = () => {
    console.log('刷新数据...');
    const { inInventoryPage, inBatchEditingPage, inProductPage } = getPageType();
  
    if (inBatchEditingPage) {
      handleBatchEditingPage();
    } else if (inInventoryPage) {
      handleInventoryPage();
    } else if (inProductPage) {
      handleProductPage();
    } else {
      console.log('未匹配到特定页面逻辑');
    }
  };
  
  /**
   * 每隔1秒为页面标题添加点击事件（作为刷新入口）
   * 这样当用户点击标题时就会执行 refreshData
   */
  const attachRefreshEvent = () => {
    const headerTitleElems = document.getElementsByClassName('Polaris-Header-Title');
    if (headerTitleElems.length > 0) {
      const headerTitle = headerTitleElems[0];
      // 移除之前的监听，防止重复绑定
      headerTitle.removeEventListener('click', refreshData);
      headerTitle.addEventListener('click', refreshData);
    }
  };
  
  // 输出提示信息
  console.log('inventory helper is running...');
  // 定时检查标题元素是否存在，绑定点击事件（刷新数据）
  setInterval(attachRefreshEvent, 1000);
  
  // 下面将辅助函数也暴露到全局作用域，方便通过控制台调用（如 copyText、mergeString、refreshData）
  window.copyText = copyText;
  window.mergeString = mergeString;
  window.refreshData = refreshData;
  