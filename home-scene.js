import { mountHomeGridOnly, mountHomeScanMask } from './boot-home-bg.js';
import {
  HOMEOVERLAP_TEX_KEY,
  addOverlapCropImage,
  createHomeDelta,
  createHomeOverlapCropDebugOverlay,
  destroyBootBgPanelForHome,
  getHomeLayout,
  redrawHomeUI,
} from './home-ui.js';
import { HOMEOVERLAP_CROPS } from './home-overlap-crops.js';

/**
 * @param {number} WORLD_W
 * @param {number} WORLD_H
 * @param {function(Phaser.Scene, function(): object): {tick?: function(): void, destroy?: function(): void} | null} createDebugHUD
 */
export function createHomeScene(WORLD_W, WORLD_H, createDebugHUD) {
  const HOME_LAYOUT = getHomeLayout(WORLD_W, WORLD_H);

  return class HomeScene extends Phaser.Scene {
    constructor() {
      super('home');
    }

    preload() {
      this.load.image('home-bg-normal', 'assets/home-bg-normal.png');
      this.load.image('home-debris', 'assets/home-debris.png');
      this.load.image(HOMEOVERLAP_TEX_KEY, 'assets/overlap-title.png');
    }

    create() {
      const L = HOME_LAYOUT;
      const SUB_TAIL_STYLE = {
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        fontSize: '14px',
        color: '#e2ded6',
      };
      /** PLAY 行の「y」— ニュートラルパネル上で読める補助文字 */
      const PLAY_Y_HEX = '#d4d0c8';

      destroyBootBgPanelForHome(this.scene.get('boot'));

      this._homeBackdrop = mountHomeGridOnly(this, {
        width: WORLD_W,
        height: WORLD_H,
      });

      const _depthRebuildPanel = -48;
      const _rebuildTexKey = 'home-bg-normal';
      this._homeRebuildPanel = this.add.image(WORLD_W / 2, WORLD_H / 2, _rebuildTexKey)
        .setOrigin(0.5, 0.5)
        .setDepth(_depthRebuildPanel);
      const _rsx = WORLD_W / this._homeRebuildPanel.width;
      const _rsy = WORLD_H / this._homeRebuildPanel.height;
      this._homeRebuildPanel.setScale(Math.max(_rsx, _rsy));

      const _scanGridStep = 52;
      const _scanStopRow  = Math.ceil(
        (HOME_LAYOUT.startCenterY - HOME_LAYOUT.startHeight / 2 - _scanGridStep) / _scanGridStep,
      );
      this._homeScanMask = mountHomeScanMask(this, {
        width:            WORLD_W,
        gridStep:         _scanGridStep,
        stopY:            _scanStopRow * _scanGridStep,
        row0IntervalMs:   91,
        rowIntervalScale: 3.5,
        targetImage:      this._homeRebuildPanel,
      });

      {
        const _debrisTex     = this.textures.get('home-debris').getSourceImage();
        const _debrisScale   = (WORLD_W * 1.08) / _debrisTex.width;
        const _debrisRot     = (Math.random() * 3 - 1.5) * (Math.PI / 180);
        this._homeDebris = this.add.image(WORLD_W / 2, WORLD_H + 20, 'home-debris')
          .setOrigin(0.5, 1)
          .setScale(_debrisScale)
          .setAlpha(0.82)
          .setRotation(_debrisRot)
          .setDepth(-54);
      }

      this._delta = {
        startFrame: createHomeDelta(),
        sub: HOME_LAYOUT.subRowTails.map(() => ({
          offsetX: 0,
          offsetY: 0,
          alpha:   1,
        })),
      };

      const _depthPlayBaseMain = 9;
      const _depthPlayGlyph = 11;
      const _depthPlayTriangle = 12;
      const _depthPlayHit = 13;
      const _depthSubPanelMain = 9;
      const _depthSubGlyph = 11;
      const _depthSubHit = 13;
      const texKey = HOMEOVERLAP_TEX_KEY;

      this._playBgPanelImg = this.add
        .image(0, 0, 'home-bg-normal')
        .setDepth(_depthPlayBaseMain)
        .setVisible(false);

      const P = HOMEOVERLAP_CROPS.P;
      const Lc = HOMEOVERLAP_CROPS.L;
      const Ac = HOMEOVERLAP_CROPS.A;
      const Vc = HOMEOVERLAP_CROPS.V;
      this._startA = addOverlapCropImage(this, texKey, Ac, _depthPlayGlyph);
      this._startP = addOverlapCropImage(this, texKey, P, _depthPlayGlyph);
      this._startL = addOverlapCropImage(this, texKey, Lc, _depthPlayGlyph);
      this._startV = addOverlapCropImage(this, texKey, Vc, _depthPlayTriangle);
      this._startY = this.add
        .text(0, 0, 'y', {
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontSize: '48px',
          color: PLAY_Y_HEX,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(_depthPlayGlyph);

      /** 「y」だけ合成アルファを下げ、グリフ行のベースライン付近に寄せる */
      this._startYGlyphAlpha = 0.82;
      this._startYBaselineOffset = 4;

      this._startHitZone = this.add.zone(L.centerX, L.startCenterY, 120, 72).setDepth(_depthPlayHit);

      const subCrops = [
        HOMEOVERLAP_CROPS.O,
        HOMEOVERLAP_CROPS.E,
        HOMEOVERLAP_CROPS.R,
      ];
      this._subRows = HOME_LAYOUT.subRowTails.map((tail, i) => {
        const head = addOverlapCropImage(this, texKey, subCrops[i], _depthSubGlyph);
        const tailT = this.add.text(0, 0, tail, SUB_TAIL_STYLE).setOrigin(0, 0.5).setDepth(_depthSubGlyph);
        const z = this.add.zone(0, 0, 88, 40).setDepth(_depthSubHit);
        const bgPanelImg = this.add
          .image(0, 0, 'home-bg-normal')
          .setDepth(_depthSubPanelMain)
          .setVisible(false);
        return { head, tail: tailT, zone: z, bgPanelImg };
      });

      this._startPressFlash = 0;

      this._redrawHomeUI();

      this._homeReady = true;
      this._debugHud = createDebugHUD(this, () => ({
        scene:     'home',
        homeReady: this._homeReady,
        scan:      this._homeScanMask ? 'active' : 'done',
        debris:    this._homeDebris ? this._homeDebris.alpha.toFixed(2) : '-',
        playRefH:  this._homePlayRefNatH != null ? String(this._homePlayRefNatH) : '-',
        homeYOffsetPx: HOME_LAYOUT.homeYOffsetPxParam,
        homeYOffsetAppliedPx: HOME_LAYOUT.homeYOffsetPxApplied,
        homeAutoOffset: HOME_LAYOUT.homeYAutoOffset,
      }));

      this._homeCropDebug = createHomeOverlapCropDebugOverlay(this);

      const cleanupHome = () => {
        this._debugHud?.destroy();
        this._debugHud = null;
        this._homeCropDebug?.destroy?.();
        this._homeCropDebug = null;
        this._homeReady = false;
        this._homeBackdrop?.destroy?.();
        this._homeBackdrop = null;
        this._homeScanMask?.destroy?.();
        this._homeScanMask = null;
        this._homeRebuildPanel?.destroy?.();
        this._homeRebuildPanel = null;
        this._homeDebris?.destroy?.();
        this._homeDebris = null;
        [
          this._startA, this._startP, this._startL, this._startV, this._startY,
        ].forEach((o) => o?.destroy?.());
        this._startA = this._startP = this._startL = this._startV = this._startY = null;
        this._playBgPanelImg?.destroy?.();
        this._playBgPanelImg = null;
        this._startHitZone?.destroy?.();
        this._startHitZone = null;
        this._subRows?.forEach((r) => {
          r.head?.destroy?.();
          r.tail?.destroy?.();
          r.zone?.destroy?.();
          r.bgPanelImg?.destroy?.();
        });
        this._subRows = null;
      };
      this.events.once('shutdown', cleanupHome);

      const _subHandlers = [
        () => { console.log('[HOME] O row pressed'); },
        () => { console.log('[HOME] E row pressed'); },
        () => { console.log('[HOME] R row pressed'); },
      ];

      let _startFired = false;
      this.input.on('pointerdown', (pointer) => {
        const zb = this._startHitZone.getBounds();
        if (zb.contains(pointer.x, pointer.y)) {
          this._startPressFlash = 1;
          this._redrawHomeUI();
          if (!_startFired) {
            _startFired = true;
            this.time.delayedCall(80, () => {
              this._startPressFlash = 0;
              this._redrawHomeUI();
              cleanupHome();
              this.scene.start('game');
            });
          }
          return;
        }
        this._subRows?.forEach((row, i) => {
          const b = row.zone.getBounds();
          if (b.contains(pointer.x, pointer.y)) {
            _subHandlers[i]();
          }
        });
      });
    }

    update() {
      this._debugHud?.tick();
    }

    _redrawHomeUI() {
      redrawHomeUI(this, HOME_LAYOUT);
    }
  };
}
