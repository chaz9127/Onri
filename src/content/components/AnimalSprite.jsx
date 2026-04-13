import DinoSprite from './animals/Dino/DinoSprite';

// Renders the selected animal. Swap DinoSprite for a different animal component
// when adding new sprites — each animal handles its own animation logic.
export default function AnimalSprite({ visible }) {
  return <DinoSprite visible={visible} />;
}
