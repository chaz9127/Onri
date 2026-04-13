import { useState, useEffect } from 'react';

export default function App() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    chrome.storage.local.get({ visible: true }, ({ visible }) => {
      setVisible(visible);
    });
  }, []);

  const toggle = () => {
    const next = !visible;
    setVisible(next);
    chrome.storage.local.set({ visible: next });
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: next ? 'show' : 'hide' });
      }
    });
  };

  return (
    <button onClick={toggle}>
      {visible ? 'Hide Sprite' : 'Show Sprite'}
    </button>
  );
}
