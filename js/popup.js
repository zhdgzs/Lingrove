/**
 * Lingrove Popup 脚本
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM 元素
  const enableToggle = document.getElementById('enableToggle');
  const totalWords = document.getElementById('totalWords');
  const todayWords = document.getElementById('todayWords');
  const learnedCount = document.getElementById('learnedCount');
  const memorizeCount = document.getElementById('memorizeCount');
  const cacheSize = document.getElementById('cacheSize');
  const hitRate = document.getElementById('hitRate');
  const processBtn = document.getElementById('processBtn');
  const restoreBtn = document.getElementById('restoreBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const excludeSiteBtn = document.getElementById('excludeSiteBtn');
  const excludeSiteText = document.getElementById('excludeSiteText');
  const siteModeText = document.getElementById('siteModeText');
  const processShortcut = document.getElementById('processShortcut');
  const restoreShortcut = document.getElementById('restoreShortcut');

  // 当前快捷键
  let currentProcessShortcut = 'Alt+T';
  let currentRestoreShortcut = 'Alt+R';

  // 加载快捷键配置
  async function loadShortcut() {
    try {
      const commands = await chrome.commands.getAll();
      const processCmd = commands.find(c => c.name === 'process-page');
      const restoreCmd = commands.find(c => c.name === 'restore-page');
      if (processCmd?.shortcut) {
        currentProcessShortcut = processCmd.shortcut;
        processShortcut.textContent = currentProcessShortcut;
      }
      if (restoreCmd?.shortcut) {
        currentRestoreShortcut = restoreCmd.shortcut;
        restoreShortcut.textContent = currentRestoreShortcut;
      }
    } catch (e) {
      console.error('Failed to load shortcut:', e);
    }
  }

  // BUILT_IN_THEMES 已移至 themes.js，通过 Lingrove.BUILT_IN_THEMES 访问

  // 应用配色主题
  function applyColorTheme(themeId, customTheme) {
    const theme = themeId === 'custom' && customTheme ? customTheme : Lingrove.BUILT_IN_THEMES[themeId] || Lingrove.BUILT_IN_THEMES.default;
    const root = document.documentElement;
    
    // 计算渐变的第二个颜色
    const secondColor = Lingrove.getSecondaryColor(theme.primary);
    
    root.style.setProperty('--primary', theme.primary);
    root.style.setProperty('--primary-light', theme.tooltipWord);
    root.style.setProperty('--primary-dark', secondColor);
  }

  // 加载主题和配色
  chrome.storage.sync.get(['theme', 'colorTheme', 'customTheme'], (result) => {
    const theme = result.theme || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
    
    // 应用配色主题
    applyColorTheme(result.colorTheme || 'default', result.customTheme);
  });
  
  // 更新主题图标
  function updateThemeIcon(theme) {
    const iconDark = themeToggleBtn.querySelector('.icon-theme-dark');
    const iconLight = themeToggleBtn.querySelector('.icon-theme-light');
    if (theme === 'light') {
      iconDark.style.display = 'none';
      iconLight.style.display = '';
    } else {
      iconDark.style.display = '';
      iconLight.style.display = 'none';
    }
  }

  // 加载配置和统计
  async function loadData() {
    // 加载启用状态
    chrome.storage.sync.get('enabled', (result) => {
      const enabled = result.enabled !== false;
      enableToggle.checked = enabled;
    });

    // 加载统计数据
    chrome.runtime.sendMessage({ action: 'getStats' }, (response) => {
      if (response) {
        totalWords.textContent = formatNumber(response.totalWords);
        todayWords.textContent = formatNumber(response.todayWords);
        learnedCount.textContent = formatNumber(response.learnedCount);
        memorizeCount.textContent = formatNumber(response.memorizeCount);

        const total = response.cacheHits + response.cacheMisses;
        const rate = total > 0 ? Math.round((response.cacheHits / total) * 100) : 0;
        hitRate.textContent = rate + '%';
      }
    });

    // 加载缓存统计
    chrome.runtime.sendMessage({ action: 'getCacheStats' }, (response) => {
      if (response) {
        cacheSize.textContent = `${response.size}/${response.maxSize}`;
      }
    });
  }

  // 格式化数字
  function formatNumber(num) {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + '万';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  }

  // 切换启用状态
  enableToggle.addEventListener('change', () => {
    const enabled = enableToggle.checked;
    chrome.storage.sync.set({ enabled }, () => {
      // 通知内容脚本
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: enabled ? 'processPage' : 'restorePage' 
          });
        }
      });
    });
  });

  // 恢复处理按钮
  function resetProcessBtn() {
    processBtn.disabled = false;
    processBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path fill="currentColor" d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
      <span>处理页面</span>
      <kbd>${currentProcessShortcut}</kbd>
    `;
  }

  // 处理页面按钮
  processBtn.addEventListener('click', async () => {
    processBtn.disabled = true;
    processBtn.innerHTML = `
      <svg class="spinning" viewBox="0 0 24 24" width="18" height="18">
        <path fill="currentColor" d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
      </svg>
      处理中...
    `;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'processPage' }, (response) => {
          setTimeout(() => {
            resetProcessBtn();
            loadData();
          }, 1000);
        });
      }
    } catch (e) {
      console.error('Error processing page:', e);
      resetProcessBtn();
    }
  });

  // 还原页面按钮
  restoreBtn.addEventListener('click', async () => {
    restoreBtn.disabled = true;
    restoreBtn.innerHTML = `
      <svg class="spinning" viewBox="0 0 24 24" width="18" height="18">
        <path fill="currentColor" d="M12,4V2A10,10 0 0,0 2,12H4A8,8 0 0,1 12,4Z"/>
      </svg>
      还原中...
    `;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'restorePage' }, (response) => {
          setTimeout(() => {
            restoreBtn.disabled = false;
            restoreBtn.innerHTML = `
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z"/>
              </svg>
              <span>还原页面</span>
              <kbd>${currentRestoreShortcut}</kbd>
            `;
            loadData();
          }, 500);
        });
      }
    } catch (e) {
      console.error('Error restoring page:', e);
      restoreBtn.disabled = false;
      restoreBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M12.5,8C9.85,8 7.45,9 5.6,10.6L2,7V16H11L7.38,12.38C8.77,11.22 10.54,10.5 12.5,10.5C16.04,10.5 19.05,12.81 20.1,16L22.47,15.22C21.08,11.03 17.15,8 12.5,8Z"/>
        </svg>
        <span>还原页面</span>
        <kbd>${currentRestoreShortcut}</kbd>
      `;
    }
  });

  // 设置按钮
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // 主题切换
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    updateThemeIcon(newTheme);
    chrome.storage.sync.set({ theme: newTheme });
  });

  // 当前站点模式
  let currentSiteMode = 'all';
  const iconExclude = excludeSiteBtn.querySelector('.icon-exclude');
  const iconInclude = excludeSiteBtn.querySelector('.icon-include');

  // 更新站点按钮状态
  function updateSiteBtn(isInList, mode) {
    excludeSiteBtn.classList.remove('active', 'active-success');
    
    if (mode === 'all') {
      // 所有网站模式：显示排除状态（红色叉）
      iconExclude.style.display = '';
      iconInclude.style.display = 'none';
      excludeSiteText.textContent = '排除';
      if (isInList) {
        excludeSiteBtn.classList.add('active');
      }
    } else {
      // 仅指定网站模式：显示添加状态（绿色勾）
      iconExclude.style.display = 'none';
      iconInclude.style.display = '';
      excludeSiteText.textContent = '添加';
      if (isInList) {
        excludeSiteBtn.classList.add('active-success');
      }
    }
  }

  // 站点按钮点击事件
  excludeSiteBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname;
      const listKey = currentSiteMode === 'all' ? 'excludedSites' : 'allowedSites';
      
      chrome.storage.sync.get(listKey, (result) => {
        const sites = result[listKey] || [];
        if (sites.includes(hostname)) {
          // 已在列表中，移除
          const newSites = sites.filter(s => s !== hostname);
          chrome.storage.sync.set({ [listKey]: newSites }, () => {
            updateSiteBtn(false, currentSiteMode);
          });
        } else {
          // 添加到列表
          sites.push(hostname);
          chrome.storage.sync.set({ [listKey]: sites }, () => {
            updateSiteBtn(true, currentSiteMode);
          });
        }
      });
    } catch (e) {
      console.error('Invalid URL:', e);
    }
  });

  // 检查当前站点状态
  async function checkSiteStatus() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return;
    
    try {
      const url = new URL(tab.url);
      const hostname = url.hostname;
      
      chrome.storage.sync.get(['siteMode', 'excludedSites', 'allowedSites'], (result) => {
        currentSiteMode = result.siteMode || 'all';
        // 更新模式提示
        siteModeText.textContent = '运行模式：' + (currentSiteMode === 'all' ? '所有网站' : '仅指定');
        
        const listKey = currentSiteMode === 'all' ? 'excludedSites' : 'allowedSites';
        const sites = result[listKey] || [];
        const isInList = sites.some(s => hostname.includes(s));
        updateSiteBtn(isInList, currentSiteMode);
      });
    } catch (e) {}
  }

  // 初始加载
  loadData();
  loadShortcut();
  checkSiteStatus();

  // 定期刷新
  setInterval(loadData, 5000);

  // 监听主题和配色变化
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
      if (changes.theme) {
        document.documentElement.setAttribute('data-theme', changes.theme.newValue);
        updateThemeIcon(changes.theme.newValue);
      }
      if (changes.colorTheme || changes.customTheme) {
        chrome.storage.sync.get(['colorTheme', 'customTheme'], (result) => {
          applyColorTheme(result.colorTheme || 'default', result.customTheme);
        });
      }
    }
  });
});
