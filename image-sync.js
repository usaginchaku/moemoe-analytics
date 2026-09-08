/* Fill locally blank image URLs from characters.json without touching user-entered URLs. */
(() => {
  function syncBaseImages(attempt = 0){
    if(typeof state === "undefined" || !Array.isArray(state.baseCharacters) || !Array.isArray(state.characters)){
      if(attempt < 40) setTimeout(() => syncBaseImages(attempt + 1), 100);
      return;
    }
    if(!state.baseCharacters.length){
      if(attempt < 40) setTimeout(() => syncBaseImages(attempt + 1), 100);
      return;
    }

    const baseMap = new Map(state.baseCharacters.map(c => [canonicalName(c.name), c]));
    let changed = false;

    for(const c of state.characters){
      const base = baseMap.get(canonicalName(c.name));
      if(!base) continue;
      const currentUrl = String(c.imageUrl || "").trim();
      const baseUrl = String(base.imageUrl || "").trim();
      if(!currentUrl && baseUrl){
        c.imageUrl = baseUrl;
        changed = true;
      }
    }

    if(changed){
      persist();
      renderAll();
    }
  }

  setTimeout(() => syncBaseImages(), 0);
})();
