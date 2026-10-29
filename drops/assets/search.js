(function(root) {
  'use strict';
  const normalize = value => String(value ?? '').normalize('NFKC').toLocaleLowerCase('zh-TW').replace(/\s+/g, '');
  function groupItems(items) {
    const groups = new Map();
    for (const item of items) {
      const label = `${item.type || '其他物品'}\u0000${item.name}`;
      if (!groups.has(label)) groups.set(label, { key: item.key, name: item.name, type: item.type || '其他物品', variants: [], sourceKeys: new Set(), conditionalSourceKeys: new Set(), searchName: normalize(item.name) });
      const group = groups.get(label);
      group.variants.push(item.key);
      for (const key of item.sourceKeys || []) group.sourceKeys.add(key);
      for (const key of item.conditionalSourceKeys || []) group.conditionalSourceKeys.add(key);
    }
    return [...groups.values()].map(group => ({ ...group, sourceKeys: [...group.sourceKeys], conditionalSourceKeys: [...group.conditionalSourceKeys].filter(key => !group.sourceKeys.has(key)) }));
  }
  function search(groups, query, type = '') {
    const q = normalize(query);
    if (!q) return [];
    const score = group => group.searchName === q ? 0 : group.searchName.startsWith(q) ? 1 : 2;
    return groups.filter(group => (!type || group.type === type) && group.searchName.includes(q)).sort((a,b) => score(a)-score(b) || a.name.localeCompare(b.name, 'zh-Hant') || a.type.localeCompare(b.type, 'zh-Hant'));
  }
  const api = { normalize, groupItems, search };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ItemDropSearch = api;
})(globalThis);
