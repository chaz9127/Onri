import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import AnimalSprite from './components/AnimalSprite';

function App() {
  const [selectedAnimals, setSelectedAnimals] = useState([]);

  useEffect(() => {
    chrome.storage.local.get({ selectedAnimals: ['dino'] }, (result) => {
      setSelectedAnimals(result.selectedAnimals);
    });

    const handler = (message) => {
      if (message.action === 'selectAnimals') {
        setSelectedAnimals(message.animals);
      }
    };

    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  return <AnimalSprite selectedAnimals={selectedAnimals} />;
}

const root = document.createElement('div');
root.id = 'onri-root';
document.body.appendChild(root);
createRoot(root).render(<App />);
