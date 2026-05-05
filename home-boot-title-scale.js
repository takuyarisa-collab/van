import { HOMEOVERLAP_TEX_KEY } from './home-overlap-constants.js';

/** BootScene の boot-title-png と同じ比率（index.html: (WORLD_W * 0.82) / imgNatW） */
export function getBootOverlapTitleScale(scene) {
  const tex = scene.textures.get(HOMEOVERLAP_TEX_KEY);
  const srcW = tex.getSourceImage().width || 1;
  return (scene.scale.width * 0.82) / srcW;
}
