import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import AnimalSprite from './components/AnimalSprite';

function App() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    chrome.storage.local.get({ visible: true }, (result) => {
      setVisible(result.visible);
    });

    const handler = (message) => {
      if (message.action === 'show') {
        setVisible(true);
        chrome.storage.local.set({ visible: true });
      } else if (message.action === 'hide') {
        setVisible(false);
        chrome.storage.local.set({ visible: false });
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  return <AnimalSprite visible={visible} />;
}

const root = document.createElement('div');
root.id = 'onri-root and test';
document.body.appendChild(root);
createRoot(root).render(<App />);
