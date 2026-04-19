import { useState, useEffect } from 'react';
import millify from 'millify';

const ANIMALS = [
  { id: 'dino', label: 'Chomp' },
  { id: 'cary', label: 'Pantheon' },
  { id: 'pug', label: 'Munchie' },
];

function dinoPreviewUrl() {
  return chrome.runtime.getURL('sprites/dino/idle/idle_1.png');
}

function pugPreviewStyle() {
  const url = chrome.runtime.getURL('sprites/pug/animations.png');
  return {
    width: 36,
    height: 32,
    backgroundImage: `url(${url})`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: '0px -128px', // idle row (row 2), first frame
    backgroundSize: '677px 478px',
    imageRendering: 'pixelated',
  };
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

const PUG_UNLOCK_STEPS = 50_000;

function TotalSteps({ total }) {
  const formatted = millify(total, { precision: 1 });
  return (
    <div style={{ textAlign: 'center', marginBottom: 4 }}>
      <span style={{ fontSize: 20, fontWeight: 700 }}>{formatted}</span>
      <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>total steps</span>
    </div>
  );
}

function AnimalCard({ id, label, selected, steps, onToggle, locked }) {
  const preview =
    id === 'dino' ? (
      <img
        src={dinoPreviewUrl()}
        width={64}
        height={47}
        alt=""
        style={{ imageRendering: 'pixelated', opacity: locked ? 0.35 : 1 }}
      />
    ) : id === 'pug' ? (
      <div style={{ ...pugPreviewStyle(), opacity: locked ? 0.35 : 1 }} />
    ) : (
      <div style={{ ...caryPreviewStyle(), opacity: locked ? 0.35 : 1 }} />
    );
  const fullSteps = steps.toLocaleString();
  return (
    <div
      title={locked ? `Unlock at ${PUG_UNLOCK_STEPS.toLocaleString()} total steps` : `${fullSteps} steps`}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: '1 1 calc(50% - 8px)', maxWidth: 'calc(50% - 8px)' }}
    >
      <button
        onClick={() => !locked && onToggle(id)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 6,
          padding: '10px 0',
          border: selected ? '2px solid #4a9eff' : '2px solid #ddd',
          borderRadius: 8,
          background: locked ? '#f0f0f0' : selected ? '#e8f2ff' : '#f9f9f9',
          cursor: locked ? 'not-allowed' : 'pointer',
          width: '100%',
          minHeight: 80,
        }}
      >
        {locked ? (
          <span style={{ fontSize: 11, color: '#bbb' }}>🔒 {millify(PUG_UNLOCK_STEPS)} steps</span>
        ) : (
          <StepCount count={steps} />
        )}
        {preview}
        <span
          style={{
            fontSize: 11,
            fontWeight: selected ? 700 : 400,
            color: locked ? '#bbb' : selected ? '#1a6fd4' : '#555',
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
  const [steps, setSteps] = useState({ dino: 0, cary: 0, pug: 0 });

  useEffect(() => {
    chrome.storage.local.get(
      { selectedAnimals: ['dino'], steps_dino: 0, steps_cary: 0, steps_pug: 0 },
      (result) => {
        setSelected(result.selectedAnimals);
        setSteps({ dino: result.steps_dino, cary: result.steps_cary, pug: result.steps_pug });
      }
    );

    const listener = (changes) => {
      if (changes.steps_dino) {
        setSteps((s) => ({ ...s, dino: changes.steps_dino.newValue ?? 0 }));
      }
      if (changes.steps_cary) {
        setSteps((s) => ({ ...s, cary: changes.steps_cary.newValue ?? 0 }));
      }
      if (changes.steps_pug) {
        setSteps((s) => ({ ...s, pug: changes.steps_pug.newValue ?? 0 }));
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

  const totalSteps = Object.values(steps).reduce((s, n) => s + n, 0);
  const pugLocked = totalSteps < PUG_UNLOCK_STEPS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <TotalSteps total={totalSteps} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {ANIMALS.map((a) => (
          <AnimalCard
            key={a.id}
            id={a.id}
            label={a.label}
            selected={selected.includes(a.id)}
            steps={steps[a.id]}
            onToggle={handleToggle}
            locked={a.id === 'pug' && pugLocked}
          />
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 10, color: '#aaa', lineHeight: 1.4 }}>
        ⚠ Clearing browser data (cookies &amp; site data) will reset step counts.
      </p>
    </div>
  );
}
