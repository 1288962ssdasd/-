/**
 * JsonRepair - LLM 返回 JSON 容错解析
 * 处理：markdown 包裹、尾逗号、单引号、未转义换行、截断等
 */
;(function () {
  'use strict';

  function stripMarkdown(raw) {
    if (!raw || typeof raw !== 'string') return '';
    var s = raw.trim();
    s = s.replace(/^```(?:json|JSON)?\s*\n?/i, '');
    s = s.replace(/\n?```\s*$/i, '');
    s = s.replace(/<[^>]+>/g, '');
    s = s.replace(/^\uFEFF/, '');
    s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');
    return s.trim();
  }

  function removeTrailingCommas(json) {
    return json.replace(/,\s*([}\]])/g, '$1');
  }

  function quoteUnquotedKeys(json) {
    return json.replace(/([{,]\s*)([a-zA-Z_][\w-]*)\s*:/g, '$1"$2":');
  }

  function escapeRawNewlinesInStrings(json) {
    var out = '';
    var inStr = false;
    var esc = false;
    for (var i = 0; i < json.length; i++) {
      var c = json[i];
      if (inStr) {
        if (esc) {
          out += c;
          esc = false;
          continue;
        }
        if (c === '\\') {
          out += c;
          esc = true;
          continue;
        }
        if (c === '"') {
          inStr = false;
          out += c;
          continue;
        }
        if (c === '\n') {
          out += '\\n';
          continue;
        }
        if (c === '\r') continue;
        out += c;
      } else {
        if (c === '"') inStr = true;
        out += c;
      }
    }
    return out;
  }

  function extractBalancedObject(text) {
    var start = text.indexOf('{');
    if (start < 0) return null;
    var depth = 0;
    var inStr = false;
    var esc = false;
    for (var i = start; i < text.length; i++) {
      var c = text[i];
      if (inStr) {
        if (esc) {
          esc = false;
          continue;
        }
        if (c === '\\') {
          esc = true;
          continue;
        }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === '{') depth++;
      if (c === '}') {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  function tryParse(str) {
    return JSON.parse(str);
  }

  function repairAndParse(raw, fallback) {
    if (raw == null) return fallback;
    if (typeof raw === 'object') return raw;

    var cleaned = stripMarkdown(String(raw));
    var candidates = [cleaned, extractBalancedObject(cleaned)].filter(Boolean);

    for (var i = 0; i < candidates.length; i++) {
      var base = candidates[i];
      var attempts = [
        base,
        removeTrailingCommas(base),
        removeTrailingCommas(escapeRawNewlinesInStrings(base)),
        removeTrailingCommas(quoteUnquotedKeys(escapeRawNewlinesInStrings(base))),
      ];
      for (var j = 0; j < attempts.length; j++) {
        try {
          return tryParse(attempts[j]);
        } catch (_) {}
      }
    }

    var salvaged = salvageWorldFromText(cleaned);
    if (salvaged) {
      console.warn('[JsonRepair] 全量解析失败，已 salvage 部分世界字段');
      return salvaged;
    }

    console.warn('[JsonRepair] 解析失败，使用 fallback');
    return fallback;
  }

  function salvageWorldFromText(text) {
    if (!text || typeof text !== 'string') return null;
    var out = { npcs: [] };

    function pickStr(key, alt) {
      var re = new RegExp('"' + key + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"', 'i');
      var m = text.match(re);
      if (m) return m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      if (alt) {
        re = new RegExp('"' + alt + '"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"', 'i');
        m = text.match(re);
        if (m) return m[1];
      }
      return '';
    }

    out.name = pickStr('name') || pickStr('worldName') || pickStr('title');
    out.era = pickStr('era') || pickStr('period');
    out.theme = pickStr('theme') || pickStr('genre');
    out.description = pickStr('description') || pickStr('background') || pickStr('summary');
    out.atmosphere = pickStr('atmosphere');

    var locM = text.match(/"keyLocations"\s*:\s*(\[[\s\S]*?\])/);
    if (locM) {
      try {
        out.keyLocations = JSON.parse(removeTrailingCommas(locM[1]));
      } catch (_) {}
    }

    var npcBlock = text.match(/"npcs"\s*:\s*(\[[\s\S]*)/);
    if (npcBlock) {
      var arrStr = extractBalancedArray(npcBlock[1]);
      if (arrStr) {
        try {
          out.npcs = JSON.parse(removeTrailingCommas(arrStr));
        } catch (_) {
          var wrap = repairAndParse('{"npcs":' + arrStr + '}', { npcs: [] });
          if (wrap && wrap.npcs) out.npcs = wrap.npcs;
        }
      }
    }

    if (!out.name && !out.description && (!out.npcs || !out.npcs.length)) return null;
    if (!out.name) out.name = (out.theme || '未知') + '世界';
    return out;
  }

  function extractBalancedArray(text) {
    if (!text) return null;
    var start = text.indexOf('[');
    if (start < 0) return null;
    var depth = 0;
    var inStr = false;
    var esc = false;
    for (var i = start; i < text.length; i++) {
      var c = text[i];
      if (inStr) {
        if (esc) {
          esc = false;
          continue;
        }
        if (c === '\\') {
          esc = true;
          continue;
        }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') {
        inStr = true;
        continue;
      }
      if (c === '[') depth++;
      if (c === ']') {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
    return null;
  }

  window.JsonRepair = {
    parse: repairAndParse,
    stripMarkdown: stripMarkdown,
    extractBalancedObject: extractBalancedObject,
    salvageWorldFromText: salvageWorldFromText,
  };

  console.log('[Core] JsonRepair 已加载');
})();
