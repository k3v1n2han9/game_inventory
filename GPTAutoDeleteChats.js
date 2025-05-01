// ==UserScript==
// @name         Auto Delete Chats
// @namespace    http://tampermonkey.net/
// @version      2025-01-06
// @description  try to take over the world!
// @author       You
// @match        https://chatgpt.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chatgpt.com
// @grant        none
// ==/UserScript==

function addDeleteChatsButton() {
  // 获取目标元素
  const targetElement = document.getElementsByClassName('bg-token-sidebar-surface-primary pt-0')[0];

  // 创建 Delete Chats 按钮
  const deleteButton = document.createElement('button');
  deleteButton.textContent = 'Delete Chats';
  deleteButton.className = 'flex w-full items-center gap-2.5 rounded-lg px-2 text-token-text-primary hover:bg-token-sidebar-surface-secondary h-9';

  // 挂载到目标元素下
  targetElement.appendChild(deleteButton);

  // 添加点击事件
  deleteButton.addEventListener('click', () => {
    const userInput = prompt('Enter your auth token:');
    if (userInput) {
      selectDivsAndSendRequests(userInput).then(() => {
        // 所有请求完成后，2秒钟后刷新页面
        setTimeout(() => {
          window.open('https://chatgpt.com/');
        }, 2000);
      });
    } else {
      console.log('No auth token provided. Request canceled.');
    }
  });
}

async function selectDivsAndSendRequests(authToken) {
  // 获取所有包含 class "relative" 和 "grow" 的 div 元素
  const selectedDivs = document.querySelectorAll('div.relative.grow');

  // 遍历元素并发送请求
  const requests = Array.from(selectedDivs).map(div => {
    // 查找上一级的 <a> 标签
    const parentLink = div.closest('a');

    // 如果存在 <a> 标签且 href 包含 "https"
    if (parentLink && parentLink.href.includes('https')) {
      // 用 / 分隔 href 并取最后一个部分作为 id
      const parts = parentLink.href.split('/');
      const id = parts[parts.length - 1];

      // 获取 div 的文字内容作为 name
      const name = div.textContent.trim();

      // 检查 name 中是否包含中文中括号【
      if (name.includes('【')) {
        console.log(`Skipped: ${name}`);
        return Promise.resolve(); // 跳过此元素的请求
      }

      // 创建对象
      const result = { name, id };
      console.log(result);

      // 构建请求 URL
      const requestUrl = `https://chatgpt.com/backend-api/conversation/${id}`;

      // 发送 PATCH 请求
      return fetch(requestUrl, {
        method: 'PATCH',
        headers: {
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,zh-TW;q=0.6',
          'authorization': `${authToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ is_visible: false }),
      })
        .then(response => {
          if (response.ok) {
            console.log(`Request successful for id: ${id}`);
          } else {
            console.error(`Request failed for id: ${id}`);
          }
        })
        .catch(error => {
          console.error(`Error sending request for id: ${id}`, error);
        });
    } else {
      return Promise.resolve(); // 如果条件不满足，返回已解决的 Promise
    }
  });

  // 等待所有请求完成
  return Promise.all(requests);
}

// 调用函数添加按钮
setTimeout(() => {
  addDeleteChatsButton();
}, 3000);


