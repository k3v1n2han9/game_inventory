// ==UserScript==
// @name         Download GPT Chat
// @namespace    http://tampermonkey.net/
// @version      2025-04-01
// @description  try to take over the world!
// @author       You
// @match        https://chatgpt.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=chatgpt.com
// @grant        none
// ==/UserScript==

setTimeout(() => {
  // 定义下载对话记录的函数
  function downloadConversationHTML() {
    // 获取第一个 class 为 "basis-auto" 的容器
    const container = document.querySelector('.basis-auto');
    if (!container) {
      console.warn('没有找到 class 为 "basis-auto" 的元素');
      return;
    }

    // 找出所有对话的 <article> 元素
    const articles = container.querySelectorAll('article');
    let conversationHTML = '';

    articles.forEach(article => {
      let role = '';
      // 判断角色：h5 表示用户提问（Q），h6 表示 ChatGPT 回答（A）
      if (article.querySelector('h5')) {
        role = 'Q';
      } else if (article.querySelector('h6')) {
        role = 'A';
      } else {
        // 如果无法识别角色则跳过此文章
        return;
      }

      // 定位对话内容区域
      const contentDiv = article.querySelector('.text-base.my-auto') || article;
      // 克隆一份 DOM 以便后续修改
      const clone = contentDiv.cloneNode(true);

      // 移除包含 “4o” 的 span 元素
      const spans = clone.querySelectorAll('span');
      spans.forEach(span => {
        if (span.innerText.trim() === '4o') {
          span.remove();
        }
      });

      // 如果是答案（A），删除 document.getElementsByClassName('justify-start') 遇到的第一个元素
      if (role === 'A') {
        const buttonGroup = document.getElementsByClassName('justify-start')[0];
        if (buttonGroup) {
          buttonGroup.remove();
        }
      }

      // 保留 HTML 结构与样式
      const contentHTML = clone.innerHTML.trim();

      // 构造对话项。对于用户提问（Q），整个内容都使用蓝色字体，且前缀加粗；答案（A）保持默认样式
      let itemHTML;
      if (role === 'Q') {
        itemHTML = `<div style="margin-bottom: 1em; color: blue !important;"><span style="font-weight: bold;">${role}:</span> ${contentHTML}</div>`;
      } else {
        itemHTML = `<div style="margin-bottom: 1em;"><span>${role}:</span> ${contentHTML}</div>`;
      }

      conversationHTML += itemHTML;
    });

    // 构造完整的 HTML 文档
    const fullHTML = `
<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <title>对话记录</title>
</head>
<body>
  ${conversationHTML}
</body>
</html>
    `.trim();

    // 使用当前 Tab 的 title 和指定日期构造下载文件名
    const currentTitle = document.title || "conversation";
    const currentDate = "2025-04-01"; // 可修改为动态获取当前日期
    const fileName = `${currentTitle}_${currentDate}.html`;

    // 创建 Blob 并触发下载
    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 创建 Download Chat 按钮
  const downloadButton = document.createElement('button');
  downloadButton.textContent = 'Download Chat';
  downloadButton.className = 'flex w-full items-center gap-2.5 rounded-lg px-2 text-token-text-primary hover:bg-token-sidebar-surface-secondary h-9';

  // 当点击按钮时触发下载函数
  downloadButton.addEventListener('click', downloadConversationHTML);

  // 将按钮挂载到指定的元素上
  const targetElement = document.getElementsByClassName('bg-token-sidebar-surface-primary pt-0')[0];
  if (targetElement) {
    targetElement.appendChild(downloadButton);
  } else {
    console.warn('没有找到挂载按钮的目标元素');
  }
}, 3000);

