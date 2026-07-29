const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..');

function loadScript(relativePath, context) {
  const source = fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

function createContext(location, config = {}) {
  const Lingrove = { config: { siteMode: 'all', ...config } };
  const context = vm.createContext({
    console,
    Node: {},
    NodeFilter: {},
    window: { Lingrove, location }
  });

  loadScript('js/content/utils.js', context);
  loadScript('js/content/dom-handler.js', context);
  return Lingrove;
}

test('开启本地地址过滤后跳过带端口的 IPv4 页面', () => {
  const L = createContext(
    { protocol: 'http:', hostname: '172.17.12.33', port: '31050' },
    { skipIPAddresses: true }
  );

  assert.equal(L.shouldProcessSite(), false);
});

test('开启本地地址过滤后跳过 file 页面', () => {
  const L = createContext(
    { protocol: 'file:', hostname: '', pathname: '/D:/111/ai-' },
    { skipIPAddresses: true }
  );

  assert.equal(L.shouldProcessSite(), false);
});

test('关闭本地地址过滤后仍按普通站点规则处理', () => {
  const L = createContext(
    { protocol: 'http:', hostname: '172.17.12.33', port: '31050' },
    { skipIPAddresses: false }
  );

  assert.equal(L.shouldProcessSite(), true);
});
