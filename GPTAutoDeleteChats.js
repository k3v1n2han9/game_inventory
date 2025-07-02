// ==UserScript==
// @name         Auto Delete Chats with Material Icons
// @namespace    http://tampermonkey.net/
// @version      2025-06-10
// @description  在页面右下角固定显示“Delete Chats”按钮，点击后批量删除聊天记录
// @author       You
// @match        https://chatgpt.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chatgpt.com
// @resource     MaterialIcons https://fonts.googleapis.com/icon?family=Material+Icons
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==

(() => {
  'use strict';

  // 通过 @resource 加载 Material Icons 的 CSS，然后内联到页面中
  const materialIconsCSS = GM_getResourceText('MaterialIcons');
  GM_addStyle(materialIconsCSS);

  // 创建并插入右下角固定容器
  const createFixedContainer = () => {
    if (document.getElementById('delete-chats-container')) return;

    const container = document.createElement('div');
    container.id = 'delete-chats-container';
    Object.assign(container.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: '10000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '8px',
    });
    document.body.appendChild(container);
  };

  // 向固定容器中添加按钮
  const addDeleteChatsButton = () => {
    createFixedContainer();
    const container = document.getElementById('delete-chats-container');
    if (!container) return;

    if (document.getElementById('btn-delete-chats')) return;

    const deleteButton = document.createElement('button');
    deleteButton.id = 'btn-delete-chats';
    deleteButton.className =
      'flex items-center gap-2.5 rounded-lg px-2 py-1 bg-gray-800 text-white hover:bg-gray-700';
    deleteButton.style.cursor = 'pointer';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-icons';
    iconSpan.style.verticalAlign = 'middle';
    iconSpan.textContent = 'delete';
    deleteButton.appendChild(iconSpan);

    deleteButton.appendChild(document.createTextNode(' Delete Chats'));

    deleteButton.addEventListener('click', () => {
      const authToken = prompt('Enter your auth token:');
      if (authToken) {
        selectDivsAndSendRequests(authToken).then(() => {
          window.location.reload();
        });
      } else {
        console.log('No auth token provided. Request canceled.');
      }
    });

    container.appendChild(deleteButton);
  };

  // 批量遍历并发送删除请求
  const selectDivsAndSendRequests = async (authToken) => {
    const selectedDivs = document.querySelectorAll('div.grow');
    const requests = Array.from(selectedDivs).map((div) => {
      const parentLink = div.closest('a');
      if (parentLink && parentLink.href.includes('https')) {
        const parts = parentLink.href.split('/');
        const id = parts[parts.length - 1];
        const name = div.textContent.trim();
        if (name.includes('【')) {
          console.log(`Skipped: ${name}`);
          return Promise.resolve();
        }
        const requestUrl = `https://chatgpt.com/backend-api/conversation/${id}`;
        return fetch(requestUrl, {
          method: 'PATCH',
          headers: {
            accept: '*/*',
            'accept-language':
              'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7,zh-TW;q=0.6',
            authorization: authToken,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ is_visible: false }),
        })
          .then((response) => {
            if (response.ok) {
              console.log(`Request successful for id: ${id}`);
            } else {
              console.error(`Request failed for id: ${id}`);
            }
          })
          .catch((error) => {
            console.error(`Error sending request for id: ${id}`, error);
          });
      }
      return Promise.resolve();
    });
    return Promise.all(requests);
  };

  // 初始延迟插入按钮
  setTimeout(addDeleteChatsButton, 3000);

  // 监控 DOM 变化，确保按钮始终可见
  const observer = new MutationObserver(() => addDeleteChatsButton());
  observer.observe(document.body, { childList: true, subtree: true });
})();
