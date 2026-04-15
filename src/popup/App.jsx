import { useState, useEffect } from 'react';
import millify from 'millify';

const ANIMALS = [
  { id: 'dino', label: 'Chomp' },
  { id: 'cary', label: 'Pantheon' },
];

function dinoPreviewUrl() {
  return chrome.runtime.getURL('sprites/dino/idle/idle_1.png');
}

function caryPreviewStyle() {
  const url = chrome.runtime.getURL('sprites/cary/idle.png');
  return {
    width: 48,
    height: 48,
    backgroundImage: `url(${url})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: '0 0',
    backgroundSize: 'auto 100%',
    imageRendering: 'pixelated',
  };
}

function StepCount({ count }) {
  const formatted = count > 0 ? millify(count, { precision: 1 }) : '0';
  return (
    <span
      style={{
        fontSize: 11,
        color: '#888',
        cursor: 'default',
        letterSpacing: '0.02em',
      }}
    >
      {formatted} steps
    </span>
  );
}

function AnimalCard({ id, label, selected, steps, onToggle }) {
  const preview =
    id === 'dino' ? (
      <img
        src={dinoPreviewUrl()}
        width={64}
        height={47}
        alt=""
        style={{ imageRendering: 'pixelated' }}
      />
    ) : (
      <div style={caryPreviewStyle()} />
    );
    const fullSteps = steps.toLocaleString();
  return (
    <div title={`${fullSteps} steps`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: 1 }}>
      
      <button
        onClick={() => onToggle(id)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
          padding: '10px 0',
          border: selected ? '2px solid #4a9eff' : '2px solid #ddd',
          borderRadius: 8,
          background: selected ? '#e8f2ff' : '#f9f9f9',
          cursor: 'pointer',
          width: '100%',
          minHeight: 80,
        }}
      >
        {<StepCount count={steps} />}
        {preview}
        <span
          style={{
            fontSize: 11,
            fontWeight: selected ? 700 : 400,
            color: selected ? '#1a6fd4' : '#555',
          }}
        >
          {label}
        </span>
      </button>
    </div>
  );
}

export default function App() {
  const [selected, setSelected] = useState([]);
  const [steps, setSteps] = useState({ dino: 0, cary: 0 });

  useEffect(() => {
    chrome.storage.local.get(
      { selectedAnimals: ['dino'], steps_dino: 0, steps_cary: 0 },
      (result) => {
        setSelected(result.selectedAnimals);
        setSteps({ dino: result.steps_dino, cary: result.steps_cary });
      }
    );

    const listener = (changes) => {
      if (changes.steps_dino) {
        setSteps((s) => ({ ...s, dino: changes.steps_dino.newValue ?? 0 }));
      }
      if (changes.steps_cary) {
        setSteps((s) => ({ ...s, cary: changes.steps_cary.newValue ?? 0 }));
      }
    };

    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const handleToggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((a) => a !== id)
      : [...selected, id];
    setSelected(next);
    chrome.storage.local.set({ selectedAnimals: next });
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: 'selectAnimals', animals: next });
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 16 }}>
        {ANIMALS.map((a) => (
          <AnimalCard
            key={a.id}
            id={a.id}
            label={a.label}
            selected={selected.includes(a.id)}
            steps={steps[a.id]}
            onToggle={handleToggle}
          />
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>
        ⚠ Clearing browser data (cookies &amp; site data) will reset step counts.
      </p>
    </div>
  );
}
