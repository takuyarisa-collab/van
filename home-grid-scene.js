import { mountHomeGridOnly } from './boot-home-bg.js';

/** Home の mountHomeGridOnly 結果を共有（Home シーンより背面の専用シーンで保持） */
export const REG_HOME_GRID_BACKDROP = 'REG_HOME_GRID_BACKDROP';

/**
 * Home 用グリッドのみを最背面シーンに載せる。
 * Boot（破片・ログ）と Home（PLAY 等）の間にシーン合成順で挟まないと、
 * 後起動の Home が Boot より手前に描画されグリッドが破片の上に乗る。
 *
 * @param {number} WORLD_W
 * @param {number} WORLD_H
 */
export function createHomeGridScene(WORLD_W, WORLD_H) {
  return class HomeGridScene extends Phaser.Scene {
    constructor() {
      super({ key: 'homeGrid' });
    }

    create() {
      const backdrop = mountHomeGridOnly(this, {
        width: WORLD_W,
        height: WORLD_H,
      });
      this.game.registry.set(REG_HOME_GRID_BACKDROP, backdrop);
      this.events.once('shutdown', () => {
        try {
          backdrop?.destroy?.();
        } catch (_) {
          /* ignore */
        }
        this.game.registry.remove(REG_HOME_GRID_BACKDROP);
      });
    }
  };
}
