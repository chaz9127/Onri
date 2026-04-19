import DinoSprite from './animals/Dino/DinoSprite';
import CarySprite from './animals/Cary/CarySprite';
import PugSprite from './animals/Pug/PugSprite';

export default function AnimalSprite({ selectedAnimals }) {
  return (
    <>
      {selectedAnimals.includes('dino') && <DinoSprite />}
      {selectedAnimals.includes('cary') && <CarySprite />}
      {selectedAnimals.includes('pug') && <PugSprite />}
    </>
  );
}
