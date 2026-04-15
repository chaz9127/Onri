import DinoSprite from './animals/Dino/DinoSprite';
import CarySprite from './animals/Cary/CarySprite';

export default function AnimalSprite({ selectedAnimals }) {
  return (
    <>
      {selectedAnimals.includes('dino') && <DinoSprite />}
      {selectedAnimals.includes('cary') && <CarySprite />}
    </>
  );
}
