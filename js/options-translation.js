/**
 * 翻译节点配置 UI 逻辑
 * @file options-translation.js
 */

(function() {
  'use strict';

  // DOM 元素引用
  let translationNodesList;
  let translationNodesEmpty;
  let translationNodeModalOverlay;
  let translationProviderSelect;
  let translationAuthFields;
  let translationNodeTestResult;

  // 当前编辑的节点 ID（null 表示新增）
  let editingNodeId = null;

  // 拖拽状态
  let draggedNode = null;

  /**
   * 初始化翻译节点配置
   */
  async function initTranslationConfig() {
    // 获取 DOM 元素
    translationNodesList = document.getElementById('translationNodesList');
    translationNodesEmpty = document.getElementById('translationNodesEmpty');
    translationNodeModalOverlay = document.getElementById('translationNodeModalOverlay');
    translationProviderSelect = document.getElementById('translationProviderSelect');
    translationAuthFields = document.getElementById('translationAuthFields');
    translationNodeTestResult = document.getElementById('translationNodeTestResult');

    if (!translationNodesList) {
      console.warn('[TranslationConfig] Translation nodes list not found');
      return;
    }

    // 绑定事件
    bindEvents();

    // 加载节点列表
    await renderTranslationNodes();
  }

  /**
   * 绑定事件处理器
   */
  function bindEvents() {
    // 添加节点按钮
    const addBtn = document.getElementById('addTranslationNodeBtn');
    if (addBtn) {
      addBtn.addEventListener('click', () => openNodeModal());
    }

    // 弹窗关闭按钮
    const closeBtn = document.getElementById('translationNodeModalClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', closeNodeModal);
    }

    // 取消按钮
    const cancelBtn = document.getElementById('cancelTranslationNodeBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeNodeModal);
    }

    // 保存按钮
    const saveBtn = document.getElementById('saveTranslationNodeBtn');
    if (saveBtn) {
      saveBtn.addEventListener('click', saveNode);
    }

    // 测试连接按钮
    const testBtn = document.getElementById('testTranslationNodeBtn');
    if (testBtn) {
      testBtn.addEventListener('click', testNodeConnection);
    }

    // 服务选择变化
    if (translationProviderSelect) {
      translationProviderSelect.addEventListener('change', updateAuthFields);
    }

    // 快速填充按钮
    document.querySelectorAll('.translation-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        applyPreset(preset);
      });
    });

    // 注意：不添加点击弹窗外部关闭的行为，用户必须点击取消或保存按钮
  }

  /**
   * 渲染翻译节点列表
   */
  async function renderTranslationNodes() {
    const nodes = await getTranslationNodes();

    if (nodes.length === 0) {
      translationNodesList.innerHTML = '';
      translationNodesEmpty.style.display = 'flex';
      return;
    }

    translationNodesEmpty.style.display = 'none';
    translationNodesList.innerHTML = nodes.map(node => createNodeCard(node)).join('');

    // 绑定节点卡片事件
    bindNodeCardEvents();
  }

  /**
   * 创建节点卡片 HTML
   */
  function createNodeCard(node) {
    const providerInfo = ProviderCapabilities[node.provider] || {};
    const providerName = providerInfo.name || node.provider;
    const statusClass = node.lastTestResult || 'untested';
    const isEnabled = node.enabled !== false;

    // 脱敏显示密钥
    const maskedKey = getMaskedKey(node);

    // 错误信息显示
    const errorHtml = node.lastTestError && node.lastTestResult === 'failed'
      ? `<div class="translation-node-error">${escapeHtml(node.lastTestError)}</div>`
      : '';

    return `
      <div class="translation-node-card ${isEnabled ? '' : 'disabled'}" data-node-id="${node.id}" draggable="true">
        <div class="translation-node-drag-handle">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M9,3H11V5H9V3M13,3H15V5H13V3M9,7H11V9H9V7M13,7H15V9H13V7M9,11H11V13H9V11M13,11H15V13H13V11M9,15H11V17H9V15M13,15H15V17H13V15M9,19H11V21H9V19M13,19H15V21H13V19Z"/>
          </svg>
        </div>
        <div class="translation-node-status ${statusClass}" title="${getStatusTitle(statusClass)}"></div>
        <div class="translation-node-info">
          <div class="translation-node-name">
            ${escapeHtml(node.name)}
            <span class="translation-node-provider">${escapeHtml(providerName)}</span>
          </div>
          <div class="translation-node-key">${escapeHtml(maskedKey)}</div>
          ${errorHtml}
        </div>
        <div class="translation-node-actions">
          <label class="translation-node-toggle" title="${isEnabled ? '点击禁用' : '点击启用'}">
            <input type="checkbox" ${isEnabled ? 'checked' : ''} data-action="toggle">
            <span class="slider"></span>
          </label>
          <button class="btn-icon" data-action="edit" title="编辑">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"/>
            </svg>
          </button>
          <button class="btn-icon" data-action="test" title="测试连接">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M11,16.5L18,9.5L16.59,8.09L11,13.67L7.91,10.59L6.5,12L11,16.5Z"/>
            </svg>
          </button>
          <button class="btn-icon btn-danger" data-action="delete" title="删除">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }

  /**
   * 获取脱敏的密钥显示
   */
  function getMaskedKey(node) {
    let key = '';
    if (node.apiKey) {
      key = node.apiKey;
    } else if (node.appId) {
      key = `appId: ${node.appId}`;
    } else if (node.secretId) {
      key = `secretId: ${node.secretId}`;
    }

    if (key.length > 10) {
      return key.slice(0, 6) + '***' + key.slice(-4);
    } else if (key.length > 4) {
      return key.slice(0, 3) + '***';
    }
    return key || '未配置';
  }

  /**
   * 获取状态标题
   */
  function getStatusTitle(status) {
    const titles = {
      success: '连接成功',
      failed: '连接失败',
      untested: '未测试'
    };
    return titles[status] || '未知状态';
  }

  /**
   * 绑定节点卡片事件
   */
  function bindNodeCardEvents() {
    // 启用/禁用开关
    translationNodesList.querySelectorAll('.translation-node-toggle input').forEach(toggle => {
      toggle.addEventListener('change', async (e) => {
        e.stopPropagation();
        const card = toggle.closest('.translation-node-card');
        const nodeId = card.dataset.nodeId;
        const enabled = toggle.checked;

        await toggleNode(nodeId, enabled);
      });
    });

    // 操作按钮
    translationNodesList.querySelectorAll('.btn-icon').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const card = btn.closest('.translation-node-card');
        const nodeId = card.dataset.nodeId;
        const action = btn.dataset.action;

        switch (action) {
          case 'edit':
            await openNodeModal(nodeId);
            break;
          case 'test':
            await testNodeById(nodeId, btn);
            break;
          case 'delete':
            await deleteNode(nodeId);
            break;
        }
      });
    });

    // 拖拽排序
    translationNodesList.querySelectorAll('.translation-node-card').forEach(card => {
      card.addEventListener('dragstart', handleDragStart);
      card.addEventListener('dragend', handleDragEnd);
      card.addEventListener('dragover', handleDragOver);
      card.addEventListener('drop', handleDrop);
      card.addEventListener('dragleave', handleDragLeave);
    });
  }

  /**
   * 切换节点启用状态
   */
  async function toggleNode(nodeId, enabled) {
    try {
      await updateTranslationNode(nodeId, { enabled });
      await renderTranslationNodes();
    } catch (error) {
      console.error('[TranslationConfig] Toggle node error:', error);
      alert('切换状态失败: ' + error.message);
    }
  }

  /**
   * 打开节点编辑弹窗
   */
  async function openNodeModal(nodeId = null) {
    editingNodeId = nodeId;

    // 更新弹窗标题
    const title = document.getElementById('translationNodeModalTitle');
    if (title) {
      title.textContent = nodeId ? '编辑翻译节点' : '添加翻译节点';
    }

    // 清空表单
    resetForm();

    // 如果是编辑模式，填充数据
    if (nodeId) {
      const nodes = await getTranslationNodes();
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        fillForm(node);
      }
    }

    // 显示弹窗
    translationNodeModalOverlay.style.display = 'flex';
  }

  /**
   * 关闭节点编辑弹窗
   */
  function closeNodeModal() {
    translationNodeModalOverlay.style.display = 'none';
    editingNodeId = null;
    resetForm();
  }

  /**
   * 重置表单
   */
  function resetForm() {
    document.getElementById('translationNodeNameInput').value = '';
    translationProviderSelect.value = '';
    document.getElementById('translationRateLimitInput').value = '';
    translationAuthFields.innerHTML = '';
    translationNodeTestResult.textContent = '';
    translationNodeTestResult.className = 'test-result';
  }

  /**
   * 填充表单数据
   */
  function fillForm(node) {
    document.getElementById('translationNodeNameInput').value = node.name || '';
    translationProviderSelect.value = node.provider || '';
    document.getElementById('translationRateLimitInput').value = node.rateLimit || '';

    // 更新认证字段
    updateAuthFields();

    // 填充认证字段值
    setTimeout(() => {
      if (node.apiKey) {
        const apiKeyInput = document.getElementById('translationApiKeyInput');
        if (apiKeyInput) apiKeyInput.value = node.apiKey;
      }
      if (node.appId) {
        const appIdInput = document.getElementById('translationAppIdInput');
        if (appIdInput) appIdInput.value = node.appId;
      }
      if (node.secretId) {
        const secretIdInput = document.getElementById('translationSecretIdInput');
        if (secretIdInput) secretIdInput.value = node.secretId;
      }
      if (node.secretKey) {
        const secretKeyInput = document.getElementById('translationSecretKeyInput');
        if (secretKeyInput) secretKeyInput.value = node.secretKey;
      }
    }, 0);
  }

  /**
   * 根据选择的服务更新认证字段
   */
  function updateAuthFields() {
    const provider = translationProviderSelect.value;
    if (!provider) {
      translationAuthFields.innerHTML = '<p class="help-text">请先选择翻译服务</p>';
      return;
    }

    const capabilities = ProviderCapabilities[provider];
    if (!capabilities) {
      translationAuthFields.innerHTML = '<p class="help-text">未知的翻译服务</p>';
      return;
    }

    const authFields = capabilities.authFields || [];
    let html = '';

    // 显示免费额度和文档地址
    if (capabilities.freeQuota || capabilities.docUrl) {
      html += `<div class="provider-info-box">`;
      if (capabilities.freeQuota) {
        html += `
          <div class="provider-info-row">
            <span class="provider-info-label">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M21,18V19A2,2 0 0,1 19,21H5C3.89,21 3,20.1 3,19V5A2,2 0 0,1 5,3H19A2,2 0 0,1 21,5V6H12C10.89,6 10,6.9 10,8V16A2,2 0 0,0 12,18M12,16H22V8H12M16,13.5A1.5,1.5 0 0,1 14.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,12A1.5,1.5 0 0,1 16,13.5Z"/>
              </svg>
              免费额度
            </span>
            <span class="provider-info-value">${escapeHtml(capabilities.freeQuota)}</span>
          </div>
        `;
      }
      if (capabilities.docUrl) {
        html += `
          <div class="provider-info-row">
            <span class="provider-info-label">
              <svg viewBox="0 0 24 24" width="14" height="14">
                <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M9,13V19H7V13H9M15,15V19H17V15H15M11,11V19H13V11H11Z"/>
              </svg>
              官方文档
            </span>
            <span class="provider-info-value provider-doc-link">
              <a href="${escapeHtml(capabilities.docUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(capabilities.docUrl)}</a>
              <button type="button" class="btn-icon-mini" onclick="window.open('${escapeHtml(capabilities.docUrl)}', '_blank')" title="打开文档">
                <svg viewBox="0 0 24 24" width="14" height="14">
                  <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                </svg>
              </button>
            </span>
          </div>
        `;
      }
      html += `</div>`;
    }

    authFields.forEach(field => {
      const label = ProviderAuthLabels[field] || field;
      const inputId = `translation${field.charAt(0).toUpperCase() + field.slice(1)}Input`;
      const isPassword = field.includes('Key') || field.includes('Secret');

      html += `
        <div class="form-group">
          <label for="${inputId}">${escapeHtml(label)}</label>
          ${isPassword ? `
            <div class="input-with-toggle">
              <input type="password" id="${inputId}" placeholder="请输入${escapeHtml(label)}">
              <button type="button" class="toggle-visibility" data-target="${inputId}">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z"/>
                </svg>
              </button>
            </div>
          ` : `
            <input type="text" id="${inputId}" placeholder="请输入${escapeHtml(label)}">
          `}
        </div>
      `;
    });

    translationAuthFields.innerHTML = html;

    // 绑定密码显示切换
    translationAuthFields.querySelectorAll('.toggle-visibility').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        if (input) {
          input.type = input.type === 'password' ? 'text' : 'password';
        }
      });
    });
  }

  /**
   * 应用预设配置
   */
  function applyPreset(preset) {
    const presets = {
      google: {
        name: '谷歌翻译',
        provider: 'google'
      },
      baidu: {
        name: '百度翻译',
        provider: 'baidu'
      },
      tencent: {
        name: '腾讯云翻译',
        provider: 'tencent'
      },
      youdao: {
        name: '有道智云',
        provider: 'youdao'
      },
      deepl: {
        name: 'DeepL',
        provider: 'deepl'
      }
    };

    const config = presets[preset];
    if (!config) return;

    document.getElementById('translationNodeNameInput').value = config.name;
    translationProviderSelect.value = config.provider;
    updateAuthFields();
  }

  /**
   * 保存节点
   */
  async function saveNode() {
    const name = document.getElementById('translationNodeNameInput').value.trim();
    const provider = translationProviderSelect.value;
    const rateLimit = parseInt(document.getElementById('translationRateLimitInput').value) || 0;

    // 验证
    if (!name) {
      alert('请输入节点名称');
      return;
    }
    if (!provider) {
      alert('请选择翻译服务');
      return;
    }

    // 收集认证字段
    const nodeData = {
      name,
      provider,
      rateLimit,
      apiKey: document.getElementById('translationApiKeyInput')?.value || '',
      appId: document.getElementById('translationAppIdInput')?.value || '',
      secretId: document.getElementById('translationSecretIdInput')?.value || '',
      secretKey: document.getElementById('translationSecretKeyInput')?.value || ''
    };

    // 验证必填认证字段
    const capabilities = ProviderCapabilities[provider];
    if (capabilities?.authFields) {
      for (const field of capabilities.authFields) {
        const value = nodeData[field];
        if (!value) {
          alert(`请输入 ${ProviderAuthLabels[field] || field}`);
          return;
        }
      }
    }

    try {
      if (editingNodeId) {
        // 更新节点
        await updateTranslationNode(editingNodeId, nodeData);
      } else {
        // 添加节点
        await addTranslationNode(nodeData);
      }

      closeNodeModal();
      await renderTranslationNodes();
    } catch (error) {
      console.error('[TranslationConfig] Save node error:', error);
      alert('保存失败: ' + error.message);
    }
  }

  /**
   * 测试节点连接（弹窗内）
   */
  async function testNodeConnection() {
    const provider = translationProviderSelect.value;
    if (!provider) {
      translationNodeTestResult.textContent = '请先选择翻译服务';
      translationNodeTestResult.className = 'test-result error';
      return;
    }

    // 收集配置
    const nodeConfig = {
      provider,
      apiKey: document.getElementById('translationApiKeyInput')?.value || '',
      appId: document.getElementById('translationAppIdInput')?.value || '',
      secretId: document.getElementById('translationSecretIdInput')?.value || '',
      secretKey: document.getElementById('translationSecretKeyInput')?.value || ''
    };

    translationNodeTestResult.textContent = '测试中...';
    translationNodeTestResult.className = 'test-result loading';

    try {
      const result = await translationService.testNodeConfig(nodeConfig);

      if (result.success) {
        translationNodeTestResult.textContent = `连接成功 (${result.latency}ms)`;
        translationNodeTestResult.className = 'test-result success';
      } else {
        translationNodeTestResult.textContent = result.error?.message || '连接失败';
        translationNodeTestResult.className = 'test-result error';
      }
    } catch (error) {
      translationNodeTestResult.textContent = error.message || '测试失败';
      translationNodeTestResult.className = 'test-result error';
    }
  }

  /**
   * 测试指定节点（列表中）
   */
  async function testNodeById(nodeId, btn) {
    const card = btn.closest('.translation-node-card');
    const statusEl = card.querySelector('.translation-node-status');
    const infoEl = card.querySelector('.translation-node-info');

    // 显示加载状态
    statusEl.className = 'translation-node-status untested';
    btn.disabled = true;

    try {
      const result = await translationService.testConnection(nodeId);
      const errorMsg = result.success ? null : (result.error?.message || '连接失败');

      // 更新节点状态（包含错误信息）
      await updateNodeTestResult(nodeId, result.success ? 'success' : 'failed', errorMsg);

      // 更新 UI
      statusEl.className = `translation-node-status ${result.success ? 'success' : 'failed'}`;
      statusEl.title = result.success ? `连接成功 (${result.latency}ms)` : errorMsg;

      // 更新错误提示
      let errorEl = card.querySelector('.translation-node-error');
      if (result.success) {
        // 成功时移除错误提示
        if (errorEl) errorEl.remove();
      } else {
        // 失败时更新或创建错误提示
        if (errorEl) {
          errorEl.textContent = errorMsg;
        } else {
          errorEl = document.createElement('div');
          errorEl.className = 'translation-node-error';
          errorEl.textContent = errorMsg;
          infoEl?.appendChild(errorEl);
        }
      }
    } catch (error) {
      const errorMsg = error.message || '测试失败';
      statusEl.className = 'translation-node-status failed';
      statusEl.title = errorMsg;

      // 更新错误提示
      let errorEl = card.querySelector('.translation-node-error');
      if (errorEl) {
        errorEl.textContent = errorMsg;
      } else {
        errorEl = document.createElement('div');
        errorEl.className = 'translation-node-error';
        errorEl.textContent = errorMsg;
        infoEl?.appendChild(errorEl);
      }

      // 保存错误状态
      await updateNodeTestResult(nodeId, 'failed', errorMsg);
    } finally {
      btn.disabled = false;
    }
  }

  /**
   * 删除节点
   */
  async function deleteNode(nodeId) {
    if (!confirm('确定要删除这个翻译节点吗？')) {
      return;
    }

    try {
      await deleteTranslationNode(nodeId);
      await renderTranslationNodes();
    } catch (error) {
      console.error('[TranslationConfig] Delete node error:', error);
      alert('删除失败: ' + error.message);
    }
  }

  // ==================== 拖拽排序 ====================

  function handleDragStart(e) {
    draggedNode = this;
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.nodeId);
  }

  function handleDragEnd() {
    this.classList.remove('dragging');
    draggedNode = null;

    // 移除所有 drag-over 样式
    translationNodesList.querySelectorAll('.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    if (this !== draggedNode) {
      this.classList.add('drag-over');
    }
  }

  function handleDragLeave() {
    this.classList.remove('drag-over');
  }

  async function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    if (this === draggedNode) return;

    // 获取新顺序
    const cards = Array.from(translationNodesList.querySelectorAll('.translation-node-card'));
    const draggedIndex = cards.indexOf(draggedNode);
    const dropIndex = cards.indexOf(this);

    // 重新排序 DOM
    if (draggedIndex < dropIndex) {
      this.parentNode.insertBefore(draggedNode, this.nextSibling);
    } else {
      this.parentNode.insertBefore(draggedNode, this);
    }

    // 保存新顺序
    const newOrder = Array.from(translationNodesList.querySelectorAll('.translation-node-card'))
      .map(card => card.dataset.nodeId);

    await reorderTranslationNodes(newOrder);
  }

  // ==================== 工具函数 ====================

  /**
   * HTML 转义
   */
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ==================== 初始化 ====================

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTranslationConfig);
  } else {
    initTranslationConfig();
  }

})();
