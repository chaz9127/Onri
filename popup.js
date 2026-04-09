const btn = document.getElementById('toggle');

chrome.storage.local.get({ visible: true }, ({ visible }) => {
  btn.textContent = visible ? 'Hide Sprite' : 'Show Sprite';

  btn.addEventListener('click', () => {
    const next = !visible;
    visible = next;
    btn.textContent = next ? 'Hide Sprite' : 'Show Sprite';

    chrome.storage.local.set({ visible: next });

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: next ? 'show' : 'hide' });
      }
    });
  });
});
