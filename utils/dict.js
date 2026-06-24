// 字典缓存：内存级缓存 + 并发去重，对齐 web 端 src/api/dict.ts
// 后端返回字段为 dictLabel/dictValue，统一在此映射为 { label, value }
import * as http from "./request.js";

const dictCache = new Map();
const pending = new Map();

function fetchDictData(dictType) {
  if (!dictType) return Promise.resolve([]);
  if (dictCache.has(dictType)) return Promise.resolve(dictCache.get(dictType));
  if (pending.has(dictType)) return pending.get(dictType);

  const p = http.get("/dicts/data/" + dictType, null, { silent: true })
    .then((res) => {
      const list = (res.data || []).map((item) => ({
        label: String(item.dictLabel != null ? item.dictLabel : (item.label || "")),
        value: String(item.dictValue != null ? item.dictValue : (item.value || ""))
      }));
      dictCache.set(dictType, list);
      return list;
    })
    .catch(() => [])
    .finally(() => pending.delete(dictType));

  pending.set(dictType, p);
  return p;
}

function getDictLabel(items, value) {
  if (!items || !items.length) return "";
  if (value === undefined || value === null || value === "") return "";
  const target = String(value);
  const hit = items.find((d) => d.value === target);
  return hit ? hit.label : target;
}

function clearDictCache(dictType) {
  if (dictType) dictCache.delete(dictType);
  else dictCache.clear();
}

export { fetchDictData, getDictLabel, clearDictCache };
