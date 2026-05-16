import { mountHomeGridOnly, mountHomeScanMask } from './boot-home-bg.js';
import { REG_HOME_GRID_BACKDROP } from './home-grid-scene.js';
import {
  HOMEOVERLAP_TEX_KEY,
  addOverlapCropImage,
  createHomeDelta,
  createHomeOverlapCropDebugOverlay,
  getHomeLayout,
  homeUrlDebugEnabled,
  redrawHomeUI,
} from './home-ui.js';
import { HOMEOVERLAP_CROPS } from './home-overlap-crops.js';
import {
  HOME_BG_REBUILD_DELAY_MS,
  REG_BOOT_COLLAPSE_DONE_FOR_HOME,
  REG_BOOT_HOME_WAIT_COLLAPSE,
  runBootToHomeOverlapRebuild,
} from './home-overlap-rebuild.js';
import { updatePlayFormationShardTail } from './boot-bg-collapse-fragments.js';

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
        color: '#c04545',
      };
      /** PLAY 行の「y」— 赤系（サブ尾より明るめ） */
      const PLAY_Y_HEX = '#ff5a5a';

      const _registry = this.game.registry;
      this._homeWaitBootCollapse = Boolean(_registry.get(REG_BOOT_HOME_WAIT_COLLAPSE));

      const _gridFromRegistry = this.game.registry.get(REG_HOME_GRID_BACKDROP);
      if (_gridFromRegistry && _gridFromRegistry.layers?.length) {
        this._homeBackdrop = _gridFromRegistry;
        this._homeBackdropOwnedByThisScene = false;
      } else {
        this._homeBackdrop = mountHomeGridOnly(this, {
          width: WORLD_W,
          height: WORLD_H,
        });
        this._homeBackdropOwnedByThisScene = true;
      }
      this._homeDarkVeil = null;
      this._homeBgRebuildStarted = false;

      const _depthRebuildPanel = -48;
      const _rebuildTexKey = 'home-bg-normal';
      this._homeRebuildPanel = this.add.image(WORLD_W / 2, WORLD_H / 2, _rebuildTexKey)
        .setOrigin(0.5, 0.5)
        .setDepth(_depthRebuildPanel);
      const _rsx = WORLD_W / this._homeRebuildPanel.width;
      const _rsy = WORLD_H / this._homeRebuildPanel.height;
      this._homeRebuildPanel.setScale(Math.max(_rsx, _rsy));
      if (this._homeWaitBootCollapse) {
        this._homeRebuildPanel.setAlpha(0);
      }

      const _scanGridStep = 52;
      const _scanStopRow  = Math.ceil(
        (HOME_LAYOUT.playCenterY - HOME_LAYOUT.startHeight / 2 - _scanGridStep) / _scanGridStep,
      );
      this._homeScanMask = mountHomeScanMask(this, {
        width:            WORLD_W,
        gridStep:         _scanGridStep,
        stopY:            _scanStopRow * _scanGridStep,
        row0IntervalMs:   91,
        rowIntervalScale: 3.5,
        targetImage:      this._homeRebuildPanel,
        deferScheduleScan: this._homeWaitBootCollapse,
      });

      {
        const _debrisTex     = this.textures.get('home-debris').getSourceImage();
        const _debrisScale   = (WORLD_W * 1.08) / _debrisTex.width;
        const _debrisRot     = (Math.random() * 3 - 1.5) * (Math.PI / 180);
        this._homeDebris = this.add.image(WORLD_W / 2, WORLD_H + 20, 'home-debris')
          .setOrigin(0.5, 1)
          .setScale(_debrisScale)
          .setAlpha(this._homeWaitBootCollapse ? 0 : 0.82)
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

      const _depthPlayFrag = _depthPlayBaseMain + 0.5;
      this._playBgMaskGfx = this.add.graphics().setVisible(false);
      this._playBgPanelImg.setMask(this._playBgMaskGfx.createGeometryMask());
      this._playBgFragEdgeGfx = this.add.graphics().setDepth(_depthPlayFrag);

      if (homeUrlDebugEnabled()) {
        const p = this._playBgPanelImg;
        console.log('[home-bg-panel-create]', {
          kind: 'PLAY',
          created: Boolean(p && !p.destroyed),
          depth: p?.depth,
          key: p?.texture?.key,
        });
      }

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

      this._startHitZone = this.add.zone(L.playCenterX, L.playCenterY, 120, 72).setDepth(_depthPlayHit);

      const subCrops = [
        HOMEOVERLAP_CROPS.O,
        HOMEOVERLAP_CROPS.E,
        HOMEOVERLAP_CROPS.R,
      ];
      this._subRows = HOME_LAYOUT.subRowTails.map((tail, i) => {
        const head = addOverlapCropImage(this, texKey, subCrops[i], _depthSubGlyph);
        const tailT = this.add
          .text(0, 0, tail, SUB_TAIL_STYLE)
          .setOrigin(0, 0.5)
          .setDepth(_depthSubGlyph)
          .setAlpha(0.72);
        const bgPanelImg = this.add
          .image(0, 0, 'home-bg-normal')
          .setDepth(_depthSubPanelMain)
          .setVisible(false);
        const z = this.add.zone(0, 0, 88, 40).setDepth(_depthSubHit);
        return { head, tail: tailT, zone: z, bgPanelImg };
      });

      this._subBgMaskGfx = [];
      this._subBgFragEdgeGfx = [];
      const _depthSubFrag = _depthSubPanelMain + 0.5;
      this._subRows.forEach((row) => {
        const mg = this.add.graphics().setVisible(false);
        row.bgPanelImg.setMask(mg.createGeometryMask());
        this._subBgMaskGfx.push(mg);
        this._subBgFragEdgeGfx.push(this.add.graphics().setDepth(_depthSubFrag));
      });

      if (homeUrlDebugEnabled()) {
        const n = this._subRows?.length ?? 0;
        console.log('[home-bg-panel-create]', {
          kind: 'SUB',
          rowCount: n,
          expectedRows: 3,
          perRowBgPanels: Boolean(
            this._subRows?.every((r) => r.bgPanelImg && !r.bgPanelImg.destroyed),
          ),
        });
        this._subRows?.forEach((r, i) => {
          console.log('[home-bg-panel-create]', {
            kind: 'SUB_ROW',
            row: i,
            bgPanel: Boolean(r.bgPanelImg && !r.bgPanelImg.destroyed),
            depth: r.bgPanelImg?.depth,
          });
        });
      }

      this._startPressFlash = 0;

      this._bootToHomeFlying = [];
      this._homeReady = false;
      this._bootCollapseBackdropApplied = false;

      runBootToHomeOverlapRebuild(this, HOME_LAYOUT, () => {
        this._homeReady = true;
      });

      if (this._homeWaitBootCollapse) {
        this.time.delayedCall(HOME_BG_REBUILD_DELAY_MS, () => {
          this._beginHomeBackdropRebuildFromBootCollapse();
        });
        this.time.delayedCall(400, () => {
          if (this._homeDebris && !this._homeDebris.destroyed) {
            this.tweens.add({
              targets: this._homeDebris,
              alpha: 0.82,
              duration: 320,
              ease: 'Sine.easeOut',
            });
          }
        });
      }
      this._debugHud = createDebugHUD(this, () => {
        const _hn = (param) => {
          const v = typeof window !== 'undefined' ? window[param] : undefined;
          return typeof v === 'number' && Number.isFinite(v) ? v : 0;
        };
        return {
          scene:     'home',
          homeReady: this._homeReady,
          scan:      this._homeScanMask ? 'active' : 'done',
          debris:    this._homeDebris ? this._homeDebris.alpha.toFixed(2) : '-',
          playRefH:  this._homePlayRefNatH != null ? String(this._homePlayRefNatH) : '-',
          homeYOffsetPx: HOME_LAYOUT.homeYOffsetPxParam,
          homeYOffsetAppliedPx: HOME_LAYOUT.homeYOffsetPxApplied,
          homeAutoOffset: HOME_LAYOUT.homeYAutoOffset,
          playDisplay:
            this._homeDbgPlayDisplayW != null && this._homeDbgPlayDisplayH != null
              ? `${Math.round(this._homeDbgPlayDisplayW)} x ${Math.round(this._homeDbgPlayDisplayH)}`
              : '-',
          subDisplay:
            this._homeDbgSubDisplayW != null && this._homeDbgSubDisplayH != null
              ? `${Math.round(this._homeDbgSubDisplayW)} x ${Math.round(this._homeDbgSubDisplayH)}`
              : '-',
          playSubGapPx: HOME_LAYOUT.playSubGapPx,
          playOffsetXY: `${_hn('HOME_PARAM_playOffsetX')},${_hn('HOME_PARAM_playOffsetY')}`,
          playPanelOffsetXY: `${_hn('HOME_PARAM_playPanelOffsetX')},${_hn('HOME_PARAM_playPanelOffsetY')}`,
          playTextOffsetXY: `${_hn('HOME_PARAM_playTextOffsetX')},${_hn('HOME_PARAM_playTextOffsetY')}`,
          sub012PanelXY:
            `${_hn('HOME_PARAM_sub0PanelOffsetX')},${_hn('HOME_PARAM_sub0PanelOffsetY')} | ${_hn('HOME_PARAM_sub1PanelOffsetX')},${_hn('HOME_PARAM_sub1PanelOffsetY')} | ${_hn('HOME_PARAM_sub2PanelOffsetX')},${_hn('HOME_PARAM_sub2PanelOffsetY')}`,
          sub012TextXY:
            `${_hn('HOME_PARAM_sub0TextOffsetX')},${_hn('HOME_PARAM_sub0TextOffsetY')} | ${_hn('HOME_PARAM_sub1TextOffsetX')},${_hn('HOME_PARAM_sub1TextOffsetY')} | ${_hn('HOME_PARAM_sub2TextOffsetX')},${_hn('HOME_PARAM_sub2TextOffsetY')}`,
        };
      });
      if (this._homeWaitBootCollapse) {
        this._debugHud?.setVisible?.(false);
      }

      this._homeCropDebug = createHomeOverlapCropDebugOverlay(this);
      if (this._homeWaitBootCollapse) {
        this._homeCropDebug?.setVisible?.(false);
      }

      const cleanupHome = () => {
        this._cancelOverlapRebuild?.();
        this._cancelOverlapRebuild = null;
        this.tweens.killAll();
        this._debugHud?.destroy();
        this._debugHud = null;
        this._homeCropDebug?.destroy?.();
        this._homeCropDebug = null;
        this._homeReady = false;
        if (this._homeBackdropOwnedByThisScene) {
          this._homeBackdrop?.destroy?.();
        }
        this._homeBackdrop = null;
        this._homeBackdropOwnedByThisScene = false;
        this._homeScanMask?.destroy?.();
        this._homeScanMask = null;
        this._homeRebuildPanel?.destroy?.();
        this._homeRebuildPanel = null;
        this._homeDebris?.destroy?.();
        this._homeDebris = null;
        if (this._homeDarkVeil && !this._homeDarkVeil.destroyed) {
          this.tweens.killTweensOf(this._homeDarkVeil);
          this._homeDarkVeil.destroy();
        }
        this._homeDarkVeil = null;
        this._bootToHomeFlying?.forEach((s) => s?.destroy?.());
        this._bootToHomeFlying = null;
        if (this._playFormationShardItems?.length) {
          this._playFormationShardItems.forEach((it) => {
            try {
              it.container?.destroy?.(true);
            } catch (_) {
              /* ignore */
            }
            const k = it.texKey;
            if (k && this.textures?.exists?.(k)) {
              try {
                this.textures.remove(k);
              } catch (_) {
                /* ignore */
              }
            }
          });
        }
        this._playFormationShardItems = null;
        this._playFormationPanelRevealMul = undefined;
        [
          this._startA, this._startP, this._startL, this._startV, this._startY,
        ].forEach((o) => o?.destroy?.());
        this._startA = this._startP = this._startL = this._startV = this._startY = null;
        this._playBgPanelImg?.destroy?.();
        this._playBgPanelImg = null;
        this._playBgMaskGfx?.destroy?.();
        this._playBgMaskGfx = null;
        this._playBgFragEdgeGfx?.destroy?.();
        this._playBgFragEdgeGfx = null;
        this._startHitZone?.destroy?.();
        this._startHitZone = null;
        this._subRows?.forEach((r) => {
          r.head?.destroy?.();
          r.tail?.destroy?.();
          r.zone?.destroy?.();
          r.bgPanelImg?.destroy?.();
        });
        this._subBgMaskGfx?.forEach((g) => g?.destroy?.());
        this._subBgMaskGfx = null;
        this._subBgFragEdgeGfx?.forEach((g) => g?.destroy?.());
        this._subBgFragEdgeGfx = null;
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
      if (
        this._homeWaitBootCollapse &&
        !this._bootCollapseBackdropApplied &&
        this.game.registry.get(REG_BOOT_COLLAPSE_DONE_FOR_HOME)
      ) {
        this._bootCollapseBackdropApplied = true;
        this._homeWaitBootCollapse = false;
        this.game.registry.remove(REG_BOOT_COLLAPSE_DONE_FOR_HOME);
        this._homeBackdrop?.layers?.forEach((layer) => {
          if (layer && !layer.destroyed) layer.setAlpha(1);
        });
        if (!this._homeBgRebuildStarted) {
          this._beginHomeBackdropRebuildFromBootCollapse();
        }
        if (this._homeDarkVeil && !this._homeDarkVeil.destroyed) {
          this.tweens.killTweensOf(this._homeDarkVeil);
          this._homeDarkVeil.destroy();
          this._homeDarkVeil = null;
        }
        this._debugHud?.setVisible?.(true);
        this._homeCropDebug?.setVisible?.(true);
        if (this._homeRebuildPanel && !this._homeRebuildPanel.destroyed) {
          this._homeRebuildPanel.setAlpha(1);
        }
        if (this._homeDebris && !this._homeDebris.destroyed && this._homeDebris.alpha < 0.1) {
          this._homeDebris.setAlpha(0.82);
        }
      }
      if (this._playFormationShardItems?.length && typeof this._overlapRebuildEpochMs === 'number') {
        const dt = this.game.loop.delta || 16.67;
        const T = performance.now() - this._overlapRebuildEpochMs;
        updatePlayFormationShardTail(this, T, dt);
        this._redrawHomeUI();
      }
      this._debugHud?.tick();
    }

    _beginHomeBackdropRebuildFromBootCollapse() {
      if (this._homeBgRebuildStarted || !this.tweens) return;
      this._homeBgRebuildStarted = true;
      if (this._homeRebuildPanel && !this._homeRebuildPanel.destroyed) {
        this._homeRebuildPanel.setAlpha(1);
      }
      this._homeScanMask?.resumeScheduledScan?.();
      this._homeBackdrop?.layers?.forEach((layer) => {
        if (!layer || layer.destroyed) return;
        this.tweens.add({
          targets: layer,
          alpha: 1,
          duration: 640,
          ease: 'Sine.easeOut',
        });
      });
      if (this._homeDarkVeil && !this._homeDarkVeil.destroyed) {
        this.tweens.add({
          targets: this._homeDarkVeil,
          alpha: 0,
          duration: 620,
          ease: 'Sine.easeOut',
          onComplete: () => {
            if (this._homeDarkVeil && !this._homeDarkVeil.destroyed) {
              this._homeDarkVeil.destroy();
            }
            this._homeDarkVeil = null;
          },
        });
      }
    }

    _redrawHomeUI() {
      redrawHomeUI(this, HOME_LAYOUT);
    }
  };
}
