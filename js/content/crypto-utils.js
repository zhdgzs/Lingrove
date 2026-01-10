/**
 * 加密签名工具函数
 * 提供各翻译 API 所需的签名函数
 * @file crypto-utils.js
 */

/**
 * MD5 哈希（用于百度翻译）
 * 使用纯 JavaScript 实现，无外部依赖
 * @param {string} str - 输入字符串
 * @returns {string} - 32位小写十六进制字符串
 */
function md5(str) {
  function md5cycle(x, k) {
    let a = x[0], b = x[1], c = x[2], d = x[3];

    a = ff(a, b, c, d, k[0], 7, -680876936);
    d = ff(d, a, b, c, k[1], 12, -389564586);
    c = ff(c, d, a, b, k[2], 17, 606105819);
    b = ff(b, c, d, a, k[3], 22, -1044525330);
    a = ff(a, b, c, d, k[4], 7, -176418897);
    d = ff(d, a, b, c, k[5], 12, 1200080426);
    c = ff(c, d, a, b, k[6], 17, -1473231341);
    b = ff(b, c, d, a, k[7], 22, -45705983);
    a = ff(a, b, c, d, k[8], 7, 1770035416);
    d = ff(d, a, b, c, k[9], 12, -1958414417);
    c = ff(c, d, a, b, k[10], 17, -42063);
    b = ff(b, c, d, a, k[11], 22, -1990404162);
    a = ff(a, b, c, d, k[12], 7, 1804603682);
    d = ff(d, a, b, c, k[13], 12, -40341101);
    c = ff(c, d, a, b, k[14], 17, -1502002290);
    b = ff(b, c, d, a, k[15], 22, 1236535329);

    a = gg(a, b, c, d, k[1], 5, -165796510);
    d = gg(d, a, b, c, k[6], 9, -1069501632);
    c = gg(c, d, a, b, k[11], 14, 643717713);
    b = gg(b, c, d, a, k[0], 20, -373897302);
    a = gg(a, b, c, d, k[5], 5, -701558691);
    d = gg(d, a, b, c, k[10], 9, 38016083);
    c = gg(c, d, a, b, k[15], 14, -660478335);
    b = gg(b, c, d, a, k[4], 20, -405537848);
    a = gg(a, b, c, d, k[9], 5, 568446438);
    d = gg(d, a, b, c, k[14], 9, -1019803690);
    c = gg(c, d, a, b, k[3], 14, -187363961);
    b = gg(b, c, d, a, k[8], 20, 1163531501);
    a = gg(a, b, c, d, k[13], 5, -1444681467);
    d = gg(d, a, b, c, k[2], 9, -51403784);
    c = gg(c, d, a, b, k[7], 14, 1735328473);
    b = gg(b, c, d, a, k[12], 20, -1926607734);

    a = hh(a, b, c, d, k[5], 4, -378558);
    d = hh(d, a, b, c, k[8], 11, -2022574463);
    c = hh(c, d, a, b, k[11], 16, 1839030562);
    b = hh(b, c, d, a, k[14], 23, -35309556);
    a = hh(a, b, c, d, k[1], 4, -1530992060);
    d = hh(d, a, b, c, k[4], 11, 1272893353);
    c = hh(c, d, a, b, k[7], 16, -155497632);
    b = hh(b, c, d, a, k[10], 23, -1094730640);
    a = hh(a, b, c, d, k[13], 4, 681279174);
    d = hh(d, a, b, c, k[0], 11, -358537222);
    c = hh(c, d, a, b, k[3], 16, -722521979);
    b = hh(b, c, d, a, k[6], 23, 76029189);
    a = hh(a, b, c, d, k[9], 4, -640364487);
    d = hh(d, a, b, c, k[12], 11, -421815835);
    c = hh(c, d, a, b, k[15], 16, 530742520);
    b = hh(b, c, d, a, k[2], 23, -995338651);

    a = ii(a, b, c, d, k[0], 6, -198630844);
    d = ii(d, a, b, c, k[7], 10, 1126891415);
    c = ii(c, d, a, b, k[14], 15, -1416354905);
    b = ii(b, c, d, a, k[5], 21, -57434055);
    a = ii(a, b, c, d, k[12], 6, 1700485571);
    d = ii(d, a, b, c, k[3], 10, -1894986606);
    c = ii(c, d, a, b, k[10], 15, -1051523);
    b = ii(b, c, d, a, k[1], 21, -2054922799);
    a = ii(a, b, c, d, k[8], 6, 1873313359);
    d = ii(d, a, b, c, k[15], 10, -30611744);
    c = ii(c, d, a, b, k[6], 15, -1560198380);
    b = ii(b, c, d, a, k[13], 21, 1309151649);
    a = ii(a, b, c, d, k[4], 6, -145523070);
    d = ii(d, a, b, c, k[11], 10, -1120210379);
    c = ii(c, d, a, b, k[2], 15, 718787259);
    b = ii(b, c, d, a, k[9], 21, -343485551);

    x[0] = add32(a, x[0]);
    x[1] = add32(b, x[1]);
    x[2] = add32(c, x[2]);
    x[3] = add32(d, x[3]);
  }

  function cmn(q, a, b, x, s, t) {
    a = add32(add32(a, q), add32(x, t));
    return add32((a << s) | (a >>> (32 - s)), b);
  }

  function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | ((~b) & d), a, b, x, s, t);
  }

  function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & (~d)), a, b, x, s, t);
  }

  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t);
  }

  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | (~d)), a, b, x, s, t);
  }

  function md5blk(s) {
    const md5blks = [];
    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = s.charCodeAt(i) +
        (s.charCodeAt(i + 1) << 8) +
        (s.charCodeAt(i + 2) << 16) +
        (s.charCodeAt(i + 3) << 24);
    }
    return md5blks;
  }

  function md5blk_array(a) {
    const md5blks = [];
    for (let i = 0; i < 64; i += 4) {
      md5blks[i >> 2] = a[i] +
        (a[i + 1] << 8) +
        (a[i + 2] << 16) +
        (a[i + 3] << 24);
    }
    return md5blks;
  }

  function md51(s) {
    const n = s.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i;

    for (i = 64; i <= n; i += 64) {
      md5cycle(state, md5blk(s.substring(i - 64, i)));
    }

    s = s.substring(i - 64);
    const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < s.length; i++) {
      tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
    }
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
      md5cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }

  function md51_array(a) {
    const n = a.length;
    const state = [1732584193, -271733879, -1732584194, 271733878];
    let i;

    for (i = 64; i <= n; i += 64) {
      md5cycle(state, md5blk_array(a.slice(i - 64, i)));
    }

    a = (i - 64) < n ? a.slice(i - 64) : [];
    const tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (i = 0; i < a.length; i++) {
      tail[i >> 2] |= a[i] << ((i % 4) << 3);
    }
    tail[i >> 2] |= 0x80 << ((i % 4) << 3);
    if (i > 55) {
      md5cycle(state, tail);
      for (i = 0; i < 16; i++) tail[i] = 0;
    }
    tail[14] = n * 8;
    md5cycle(state, tail);
    return state;
  }

  function hex(x) {
    const hex_chr = '0123456789abcdef'.split('');
    let s = '';
    for (let i = 0; i < x.length; i++) {
      s += hex_chr[(x[i] >> 4) & 0x0f] + hex_chr[x[i] & 0x0f];
    }
    return s;
  }

  function rhex(n) {
    const hex_chr = '0123456789abcdef'.split('');
    let s = '';
    for (let j = 0; j < 4; j++) {
      s += hex_chr[(n >> (j * 8 + 4)) & 0x0f] + hex_chr[(n >> (j * 8)) & 0x0f];
    }
    return s;
  }

  function add32(a, b) {
    return (a + b) & 0xffffffff;
  }

  function hex_md5(s) {
    return rhex(md51(s)[0]) + rhex(md51(s)[1]) + rhex(md51(s)[2]) + rhex(md51(s)[3]);
  }

  // 处理 UTF-8 编码
  function utf8Encode(str) {
    let utf8 = '';
    for (let i = 0; i < str.length; i++) {
      let charCode = str.charCodeAt(i);
      if (charCode < 128) {
        utf8 += String.fromCharCode(charCode);
      } else if (charCode < 2048) {
        utf8 += String.fromCharCode((charCode >> 6) | 192);
        utf8 += String.fromCharCode((charCode & 63) | 128);
      } else if (charCode < 65536) {
        utf8 += String.fromCharCode((charCode >> 12) | 224);
        utf8 += String.fromCharCode(((charCode >> 6) & 63) | 128);
        utf8 += String.fromCharCode((charCode & 63) | 128);
      } else {
        utf8 += String.fromCharCode((charCode >> 18) | 240);
        utf8 += String.fromCharCode(((charCode >> 12) & 63) | 128);
        utf8 += String.fromCharCode(((charCode >> 6) & 63) | 128);
        utf8 += String.fromCharCode((charCode & 63) | 128);
      }
    }
    return utf8;
  }

  const state = md51(utf8Encode(str));
  return rhex(state[0]) + rhex(state[1]) + rhex(state[2]) + rhex(state[3]);
}

/**
 * SHA256 哈希（用于有道翻译）
 * 使用 Web Crypto API
 * @param {string} str - 输入字符串
 * @returns {Promise<string>} - 64位小写十六进制字符串
 */
async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * HMAC-SHA256 签名（用于腾讯云翻译）
 * 使用 Web Crypto API
 * @param {string|ArrayBuffer} key - 密钥
 * @param {string} message - 消息
 * @returns {Promise<ArrayBuffer>} - 签名结果
 */
async function hmacSha256(key, message) {
  const encoder = new TextEncoder();

  // 如果 key 是字符串，转换为 ArrayBuffer
  const keyData = typeof key === 'string' ? encoder.encode(key) : key;

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const messageData = encoder.encode(message);
  return await crypto.subtle.sign('HMAC', cryptoKey, messageData);
}

/**
 * HMAC-SHA256 签名并返回十六进制字符串
 * @param {string} key - 密钥
 * @param {string} message - 消息
 * @returns {Promise<string>} - 64位小写十六进制字符串
 */
async function hmacSha256Hex(key, message) {
  const signature = await hmacSha256(key, message);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * ArrayBuffer 转十六进制字符串
 * @param {ArrayBuffer} buffer
 * @returns {string}
 */
function arrayBufferToHex(buffer) {
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 腾讯云 TC3-HMAC-SHA256 签名算法
 * @param {Object} options - 签名选项
 * @param {string} options.secretId - SecretId
 * @param {string} options.secretKey - SecretKey
 * @param {string} options.service - 服务名称（如 'tmt'）
 * @param {string} options.host - 主机名
 * @param {string} options.action - 操作名称
 * @param {string} options.version - API 版本
 * @param {string} options.region - 地域
 * @param {Object} options.payload - 请求体
 * @param {number} [options.timestamp] - 时间戳（秒）
 * @returns {Promise<Object>} - 包含签名和请求头的对象
 */
async function tencentCloudSign(options) {
  const {
    secretId,
    secretKey,
    service,
    host,
    action,
    version,
    region,
    payload,
    timestamp = Math.floor(Date.now() / 1000)
  } = options;

  const encoder = new TextEncoder();
  const algorithm = 'TC3-HMAC-SHA256';
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const contentType = 'application/json; charset=utf-8';

  // 日期
  const date = new Date(timestamp * 1000).toISOString().split('T')[0];

  // 请求体
  const payloadStr = JSON.stringify(payload);

  // 计算请求体哈希
  const hashedPayload = await sha256(payloadStr);

  // 规范请求
  const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest = [
    httpRequestMethod,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    hashedPayload
  ].join('\n');

  // 待签名字符串
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = await sha256(canonicalRequest);
  const stringToSign = [
    algorithm,
    timestamp,
    credentialScope,
    hashedCanonicalRequest
  ].join('\n');

  // 计算签名
  const secretDate = await hmacSha256(encoder.encode('TC3' + secretKey), date);
  const secretService = await hmacSha256(secretDate, service);
  const secretSigning = await hmacSha256(secretService, 'tc3_request');
  const signature = arrayBufferToHex(await hmacSha256(secretSigning, stringToSign));

  // 构造 Authorization
  const authorization = `${algorithm} Credential=${secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    authorization,
    timestamp,
    headers: {
      'Authorization': authorization,
      'Content-Type': contentType,
      'Host': host,
      'X-TC-Action': action,
      'X-TC-Timestamp': timestamp.toString(),
      'X-TC-Version': version,
      'X-TC-Region': region
    },
    body: payloadStr
  };
}

/**
 * 有道翻译签名算法
 * @param {Object} options - 签名选项
 * @param {string} options.appKey - 应用 Key
 * @param {string} options.appSecret - 应用密钥
 * @param {string} options.query - 查询文本
 * @param {string} [options.salt] - 随机数
 * @param {string} [options.curtime] - 当前时间戳（秒）
 * @returns {Promise<Object>} - 包含签名参数的对象
 */
async function youdaoSign(options) {
  const {
    appKey,
    appSecret,
    query,
    salt = Date.now().toString(),
    curtime = Math.floor(Date.now() / 1000).toString()
  } = options;

  // 计算 input
  // 如果 query 长度大于 20，则 input = query前10位 + query长度 + query后10位
  const input = query.length > 20
    ? query.slice(0, 10) + query.length + query.slice(-10)
    : query;

  // 签名字符串: appKey + input + salt + curtime + appSecret
  const signStr = appKey + input + salt + curtime + appSecret;
  const sign = await sha256(signStr);

  return {
    appKey,
    salt,
    curtime,
    signType: 'v3',
    sign
  };
}

/**
 * 百度翻译签名算法
 * @param {Object} options - 签名选项
 * @param {string} options.appId - 应用 ID
 * @param {string} options.secretKey - 密钥
 * @param {string} options.query - 查询文本
 * @param {string} [options.salt] - 随机数
 * @returns {Object} - 包含签名参数的对象
 */
function baiduSign(options) {
  const {
    appId,
    secretKey,
    query,
    salt = Date.now().toString()
  } = options;

  // 签名字符串: appId + query + salt + secretKey
  const signStr = appId + query + salt + secretKey;
  const sign = md5(signStr);

  return {
    appid: appId,
    salt,
    sign
  };
}

// ==================== 导出 ====================

// 如果在模块环境中
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    md5,
    sha256,
    hmacSha256,
    hmacSha256Hex,
    arrayBufferToHex,
    tencentCloudSign,
    youdaoSign,
    baiduSign
  };
}
