// ==UserScript==
// @name         game_inventory
// @namespace    http://tampermonkey.net/
// @version      V.20250218
// @description  Boardgame Master产品页面库存辅助工具
// @author       Kevin Zhang
// @match        https://admin.shopify.com/store/boardgame-master/*
// @grant        none
// ==/UserScript==

const run = () => {
  /**
   * 检查当前页面 URL 判断所在页面类型
   * @returns {Object} 包含 inInventoryPage、inBatchEditingPage、inProductPage 属性
   */
  const getPageType = () => {
    const url = location.href;
    const inInventoryPage = url.includes(
      "admin.shopify.com/store/boardgame-master/products/inventory"
    );
    const inBatchEditingPage = url.includes(
      "admin.shopify.com/store/boardgame-master/bulk"
    );
    // 产品页不包含库存页面
    const inProductPage =
      url.includes("admin.shopify.com/store/boardgame-master/products") &&
      !inInventoryPage;
    return { inInventoryPage, inBatchEditingPage, inProductPage };
  };

  /**
   * 模板字符串占位符替换函数
   * 将模板中所有类似 {{key}} 的占位符替换为 values 对应的值
   * @param {string} template 模板字符串
   * @param {Object} values 键值对
   * @returns {string} 替换后的字符串
   */
  const mergeString = (template, values) =>
    template.replace(/{{(.*?)}}/g, (_, key) => values[key] ?? "");

  /**
   * 复制文本到剪贴板
   * 优先使用 Clipboard API，如不支持则回退到 execCommand
   * @param {string} text 要复制的文本
   */
  const copyText = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => console.log("Text copied to clipboard!"))
        .catch((err) => console.error("Failed to copy text: ", err));
    } else {
      // 降级方案：创建隐藏输入框进行复制
      const virtualInput = document.createElement("input");
      virtualInput.style.position = "fixed";
      virtualInput.style.opacity = "0";
      virtualInput.style.pointerEvents = "none";
      document.body.appendChild(virtualInput);
      virtualInput.value = text;
      virtualInput.select();
      virtualInput.setSelectionRange(0, 99999); // 针对移动设备
      try {
        const successful = document.execCommand("copy");
        console.log(
          successful ? "Text copied to clipboard!" : "Failed to copy text."
        );
      } catch (err) {
        console.error("Failed to copy text: ", err);
      }
      document.body.removeChild(virtualInput);
    }
  };

  /**
   * 统一从当前页面抓取并清洗标题，返回 cleanTitle（若抓不到则返回空字符串）
   */
  const getCleanTitleFromPage = () => {
    // 优先抓可见 H1
    const h1 = document.querySelector(".Polaris-Text--headingLg");
    const fallbackLabel = document.getElementsByClassName(
      "Polaris-Labelled__LabelWrapper"
    )[0];
    const rawTitle = (h1?.textContent || fallbackLabel?.innerText || "").trim();

    // 统一特殊空格 → 普通空格；去掉中括号内容（含全角）；HTML实体；移除特殊字符；挤压空格
    const cleanTitle = rawTitle
      .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000]/g, " ")
      .replace(/[\[\【][\s\S]*?[\]\】]/g, "") // 去掉 [ ... ] / 【 ... 】
      .replace(/&amp;/g, "&")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    return cleanTitle;
  };

  /**
   * 发送 GET 请求到 checkgame API，并解析返回的 JSON 数据
   * 现在统一用“名称”（cleanTitle）去查询
   * @param {string} name 清洗后的游戏名称
   * @returns {Promise<Object>} Promise 对象，解析后的 JSON 数据
   */
  const fetchDataByName = (name) => {
    const apiUrl = "https://game.kevinzhang.info/check-game/";
    const url = encodeURI(apiUrl + name);
    return fetch(url).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Network response was not ok, status: ${response.status}`
        );
      }
      return response.json();
    });
  };

  /**
   * 批量修改页面处理逻辑：
   * 遍历所有行，尝试获取全局 cleanTitle（若无则回退到该行 SKU）进行查询，
   * 根据返回结果在对应行追加价格或状态提示。
   */
  const handleBatchEditingPage = () => {
    console.log("当前为批量修改页面");
    const pageCleanTitle = getCleanTitleFromPage(); // 页面级别的标题（尽力而为）
    // 延时2秒等待页面元素加载完成
    setTimeout(() => {
      $(".spreadsheet__row").each(function () {
        const $row = $(this);
        const sku = $row.find("#product_variant_sku").val() || "";
        const nameForQuery = pageCleanTitle || sku; // 优先用名称，兜底用 SKU 防止空查询
        if (nameForQuery) {
          fetchDataByName(nameForQuery)
            .then((result) => {
              const tailElem = $row.find(".variant-option-value");
              let tailHTML = tailElem.html();
              // 如果有价格则标蓝，否则标红
              tailHTML += result.price
                ? `<span style="color:blue">($${result.price})</span>`
                : `<span style="color:red">(${result.status})</span>`;
              tailElem.html(tailHTML);
            })
            .catch((error) =>
              console.error(`Error fetching by name '${nameForQuery}':`, error)
            );
        }
      });
    }, 2000);
  };

  /**
   * 库存主页面处理逻辑：
   * 隐藏原有库存状态，对每个 SKU 位置发起请求（优先用页面 cleanTitle，兜底该 SKU），然后在对应位置追加状态提示。
   */
  const handleInventoryPage = () => {
    console.log("当前为库存主页面");

    // 隐藏所有已有的库存状态元素
    Array.from(document.getElementsByClassName("inventory-status")).forEach(
      (elem) => (elem.style.display = "none")
    );

    // 获取所有显示 SKU 的元素
    const skuElems = document.getElementsByClassName("_Sku_gfy7s_1");
    const titleElems = document.getElementsByClassName(
      "_ProductLink_1mu6q_24 _primary_1mu6q_45"
    );
    // 保存 SKU 对应的 DOM 元素及其文本（可能带有 '+' 符号）
    const skuObjects = Array.from(skuElems)
      .concat(Array.from(titleElems))
      .map((elem) => ({
        elem,
        skuWithPlus: elem.innerText,
      }));

    // 去除所有中文中括号【】内的内容并做 trim
    function sanitizeNameForQuery(str) {
      if (typeof str !== "string") return "";
      return str.replace(/【[^】]*】/g, "").trim();
    }

    skuObjects.forEach((skuObj) => {
      // 处理 SKU 中可能带有 '+' 的情况，取最后一个部分
      let { skuWithPlus } = skuObj;
      let sku = skuWithPlus.includes("+")
        ? skuWithPlus.split("+").pop().trim()
        : skuWithPlus.trim();
      skuObj.sku = sku;

      // 去除中文中括号内容，并 trim
      const nameForQuery = sanitizeNameForQuery(sku);

      fetchDataByName(nameForQuery)
        .then((result) => {
          const target = skuObjects.find((item) => item.sku === sku);
          const style =
            result.status === "Order Now"
              ? "color:blue"
              : "color:red;font-weight:bold";
          target.elem.innerHTML += `<br><span class="inventory-status" style="${style}"> (${result.status})</span>`;
        })
        .catch((error) =>
          console.error(`Error fetching by name '${nameForQuery}':`, error)
        );
    });
  };

  /**
   * 预购提示信息模板（有具体日期的预购）
   * 此模板中只有最后一段采用红色显示，与反馈要求一致
   */
  const arrivalMessageTemplateWithDate = `
  <p><strong>Please review our pre-order policy at the bottom of the webpage before placing your order. This is especially important if you would like items shipped separately.</strong></p>
  <p><strong>All products purchased together with pre-order items will be dispatched in one shipment once all pre-order items in the order are available. As pre-order items are often subject to delays, we strongly recommend placing separate orders for pre-order and in-stock items to ensure faster delivery of available products.</strong></p>
  <p><span style="color: #ff0000;"><strong>Please note that the following item is a pre-order and will not be dispatched until its official release. The estimated release/restock date is {{arrival}}. Your order will be shipped as soon as we receive stock.</strong></span></p>
`;

  /**
   * 预购提示信息模板（无具体日期的预购）
   * 此模板中第二、第三段采用红色显示，与反馈要求一致
   */
  const arrivalMessageTemplateNoDate = `
  <p><strong>Please review our pre-order policy at the bottom of the webpage before placing your order — especially if you prefer to have items shipped separately.</strong></p>
  <p><span style="color: #ff0000;"><strong>Please note that the following product is a pre-order and is expected to be released/restocked in {{arrival}} (one month after the VR date).</strong></span></p>
  <p><span style="color: #ff0000;"><strong>As our supplier has not provided an exact release/restock date, delays are possible. For this reason, we strongly recommend placing a separate order for this item to avoid potential delays in the dispatch of your entire order.</strong></span></p>
`;

  /**
   * 根据返回的日期数据计算新 SKU 和到货日期
   * @param {Array} dateArr 日期数组，可能包含具体日份或仅有月份信息
   * @param {Object} ret 接口返回数据（需要 ret.num_on）
   * @param {Array} monthStr 数组：['', "Jan", "Feb", ...]
   * @param {Array} monthStrFull 数组：['', "January", "February", ...]
   * @returns {Object} 包含 newSku 与 arrival（到货日期）属性
   */
  const computeArrivalInfo = (dateArr, ret, monthStr, monthStrFull) => {
    const MS_PER_DAY = 86400000;
    let newSku = "";
    let arrival = "";

    if (dateArr.length === 3) {
      // 当日期中包含具体日份，例如 "21st Mar 2025"
      let day = dateArr[0].slice(0, -2); // 去掉 st, nd, rd, th
      // 若日份不足两位，补零
      day = day.padStart(2, "0");
      // dateArr[1] 为月份缩写，dateArr[2] 为年份
      let monthIndex = monthStr.indexOf(dateArr[1]);
      let month = monthIndex < 10 ? "0" + monthIndex : "" + monthIndex;
      // 构造基准日期字符串（采用 ISO 格式确保解析正确）
      const baseDateStr = `${dateArr[2]}-${month}-${day}T00:00:00`;
      const baseDate = new Date(baseDateStr);
      // 加上28天，计算到货日期
      const arrivalDate = new Date(baseDate.getTime() + 28 * MS_PER_DAY);
      newSku = `9999${month}${day}${ret.num_on}`;
      arrival = `${arrivalDate.getDate()} ${
        monthStrFull[arrivalDate.getMonth() + 1]
      } ${arrivalDate.getFullYear()}`;
    } else if (dateArr.length === 0) {
      // 没有具体到货日期信息
      arrival = "(unknown)";
    } else {
      // 只有月份信息，例如 "Mar 2025"
      const year = parseInt(dateArr[1].substring(0, 4), 10);
      // monthStr 为 ['', "Jan", "Feb", ...]，dateArr[0] 在其中的索引为 1-based，转换为 0-based
      const monthIndex = monthStr.indexOf(dateArr[0]) - 1;
      // 构造当月第一天
      const baseDate = new Date(year, monthIndex, 1);
      // 按需求加一个月
      baseDate.setMonth(baseDate.getMonth() + 1);
      arrival = `${
        monthStrFull[baseDate.getMonth() + 1]
      } ${baseDate.getFullYear()}`;
    }

    return { newSku, arrival };
  };

  /**
   * 具体产品页处理逻辑：
   * 获取页面中 SKU 与标题元素，发起请求后根据返回信息在标题中追加状态及供应商链接，
   * 若产品为预购/即将到货，则追加复制按钮和到货提示信息（根据是否有具体日期显示不同提示）。
   */
  const handleProductPage = () => {
    console.log("当前为产品页");

    // 获取页面主要元素
    const titleElem = document.getElementsByClassName(
      "Polaris-Labelled__LabelWrapper"
    )[0];
    const titleContainerElem = document.getElementsByClassName(
      "Polaris-Page-Header__TitleWrapper"
    )[0];
    const gameTitle = titleElem?.innerText || "";
    let sku = document.getElementById("InventoryCardSku")?.value || "";
    if (sku.includes("+")) {
      sku = sku.split("+").pop();
    }

    // 基于 class 抓取可见 H1 文本，做清洗
    const cleanTitle = getCleanTitleFromPage();
    console.log("Cleaned Title:", cleanTitle);

    // 用 cleanTitle 作为 Let's Play 的搜索词（空格→+）
    const cleanTitleQuery = encodeURIComponent(cleanTitle).replace(/%20/g, "+");

    // ✅ 这里改为用名称查询 checkgame
    fetchDataByName(cleanTitle)
      .then((ret) => {
        const status = ret.status;

        // 在标题区域追加状态标识及供应商网站链接
        // VR 仍然用 SKU；Let's Play 改为 cleanTitleQuery
        if (!titleContainerElem.querySelector(".search-result")) {
          titleContainerElem.insertAdjacentHTML(
            "beforeend",
            `<div class="search-result">
      <h1><span style="color:red">(${status})</span></h1>
    </div>`
          );
        }

        // 2) 供应商链接（只插入一次）
        if (!titleContainerElem.querySelector(".supplier-links")) {
          titleContainerElem.insertAdjacentHTML(
            "beforeend",
            `
    <div class="supplier-links">
      <a target="_blank" href="https://www.vrdistribution.com.au/search?q=${sku}">供应商网站（VR）</a>
      <br>
      <a target="_blank" href="https://letsplaygames.com.au/catalogsearch/result/?q=${cleanTitleQuery}">供应商网站（Let's Play - title）</a>
      <br>
      <a target="_blank" href="https://letsplaygames.com.au/catalogsearch/result/?q=${sku}">供应商网站（Let's Play - sku）</a>
    </div>
    `
          );
        }

        // 检查各个 label 元素，便于适配页面变动
        const titleLabel = document.getElementsByClassName(
          "Polaris-Label__Text"
        )[0];
        const collectionLabel = document.getElementById(
          "CollectionsAutocompleteField1Label"
        );
        const skuLabel = document.getElementById("InventoryCardSkuLabel");
        const gameDescriptionLabel = document.getElementsByClassName(
          "Polaris-Labelled__LabelWrapper"
        )[1];

        [
          { name: "title", elem: titleLabel },
          { name: "collection", elem: collectionLabel },
          { name: "sku", elem: skuLabel },
          { name: "description", elem: gameDescriptionLabel },
        ].forEach((item) => {
          if (!item.elem) {
            console.log(`${item.name} 元素获取失败`);
          }
        });

        // 当状态中包含 "Arriving Soon" 或 "Pre Order" 时，追加复制按钮及提示信息
        if (status.includes("Arriving Soon") || status.includes("Pre Order")) {
          // 为标题 label 追加复制按钮，点击后复制【Pre-Order】文本
          if (titleLabel) {
            titleLabel.innerHTML += mergeString(
              `<a href="javascript:copyText('【Pre-Order】')">复制</a>`,
              { game_title: gameTitle }
            );
          }
          if (collectionLabel) {
            collectionLabel.innerHTML += `<br><a href="javascript:copyText('Pre-Order')">复制Pre-Order</a>`;
            if (status === "Pre Order") {
              collectionLabel.innerHTML += `<br><a href="javascript:copyText('Early Bird Discount')">复制Early Bird Discount</a>`;
            }
          }

          // 根据接口返回的日期数据处理到货信息
          const dateArr = ret.date.split(" ").filter((a) => a);
          // 定义月份缩写和全称数组
          const monthStr = [
            "",
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
          const monthStrFull = [
            "",
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

          // 复用 computeArrivalInfo 计算新的 SKU 和到货日期
          const { newSku, arrival } = computeArrivalInfo(
            dateArr,
            ret,
            monthStr,
            monthStrFull
          );

          // 在 newSku 后追加加号（符合需求格式）
          const finalNewSku = newSku + "+";

          // 为 SKU label 追加复制按钮
          if (skuLabel) {
            skuLabel.innerHTML += mergeString(
              `<a href="javascript:copyText('{{newSku}}')">复制</a>`,
              { newSku: finalNewSku }
            );
          }

          // 根据是否有具体日期选择不同的预购提示模板
          const templateToUse =
            dateArr.length === 3
              ? arrivalMessageTemplateWithDate
              : arrivalMessageTemplateNoDate;
          const prependHTML = mergeString(templateToUse, { arrival });

          if (gameDescriptionLabel) {
            gameDescriptionLabel.innerHTML += `<br>手动复制粘贴以下内容<br><div style="background-color: lightgray">${prependHTML}</div>`;
          }
        }
      })
      .catch((error) =>
        console.error(`Error fetching by name '${cleanTitle}':`, error)
      );
  };

  /**
   * 主刷新函数，根据当前页面类型执行相应的处理逻辑
   */
  const refreshData = () => {
    console.log("刷新数据...");
    const { inInventoryPage, inBatchEditingPage, inProductPage } =
      getPageType();

    if (inBatchEditingPage) {
      handleBatchEditingPage();
    } else if (inInventoryPage) {
      handleInventoryPage();
    } else if (inProductPage) {
      handleProductPage();
    } else {
      console.log("未匹配到特定页面逻辑");
    }
  };

  /**
   * 每隔1秒为页面标题添加点击事件（作为刷新入口），
   * 当用户点击标题时触发 refreshData 进行数据刷新
   */
  const attachRefreshEvent = () => {
    const headerTitleElems = document.getElementsByClassName(
      "Polaris-Page-Header__TitleWrapper"
    );
    if (headerTitleElems.length > 0) {
      const headerTitle = headerTitleElems[0];
      // 移除之前的监听，防止重复绑定
      headerTitle.removeEventListener("click", refreshData);
      headerTitle.addEventListener("click", refreshData);
    }
  };

  // 输出提示信息
  console.log("inventory helper is running...");
  // 定时检查标题元素是否存在，绑定点击事件（刷新数据）
  setInterval(attachRefreshEvent, 1000);

  // 暴露辅助函数到全局作用域，方便通过控制台调用
  window.copyText = copyText;
  window.mergeString = mergeString;
  window.refreshData = refreshData;
};
run();
