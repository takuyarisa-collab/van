export const NEAR_ATTACK_PROFILE = {
  range: 244,
  width: 44,
  damage: 3,
};

export const NEAR_ATTACK_VISUAL = {
  /** 表示のみ（判定は NEAR_ATTACK_PROFILE の range / width） */
  laneLength: NEAR_ATTACK_PROFILE.range,
  laneColor: 0xc5d9e8,
  laneAlpha: 0.5,
  /** 根元・先端の全幅（細めの帯＋軽いテーパー） */
  laneWidth: 22,
  laneTipWidth: 17,
  durationMs: 460,
  steerLerp: 0.2,
  maxSteerStepRad: 0.12,
  steerDurationMs: 160,
  minSteerSpeed: 58,
};

export const NEAR_ATTACK_HIT_TUNING = {
  widthPadding: 8,
  lengthPadding: 6,
  enemyRadiusScale: 0.45,
  enemyRadiusMin: 4,
  enemyRadiusMax: 11,
  debugHitFlashMs: 110,
};

/** NEAR 前方 OBB 内の「低抵抗レーン」（判定・ダメージは NEAR_ATTACK_HIT_TUNING のまま） */
export const NEAR_ATTACK_DRIFT = {
  /** 毎フレーム速度に掛ける係数（小さめの減衰＋後続の assist と併用） */
  frictionScale: 0.93,
  /** 進行方向への補助加速度（px/s 換算・単発インパルス後のごく弱い継続補助） */
  assistForce: 130,
  /** ローカル Y オフセットに比例する中央寄せ（弱い） */
  centerPull: 14,
  /**
   * 発動瞬間のみ velocity へ加算（正規化 dir 方向、体感用に強め。
   * 単位は速度と同系で、moveSpeed 300 前後の基準でチューンする）。
   */
  nearImpulse: 440,
};

/**
 * NEAR 表示中のみの「前方からの接触ダメージ」軽減（OBB 不使用・内積のみ）。
 * activeNearAttack が有効な間・かつ endAt 未満のとき onEnemyTouch から利用する。
 */
export const NEAR_ATTACK_FRONT_CONTACT_TUNING = {
  /** 正規化ベクトル player→enemy と NEAR の dir の内積がこれ以上なら「前方」（約 ±60°） */
  minForwardDot: 0.5,
  /** 接触ダメージに掛ける係数（1 - 0.32 ≒ 68% 軽減） */
  damageTakenMultiplier: 0.32,
};

export const DEBUG_NEAR_ATTACK_HITBOX = false;

export function stopNearAttackLaunchTween(scene, nearEvent) {
  if (!nearEvent?.launchTween || !scene?.tweens) return;
  scene.tweens.remove(nearEvent.launchTween);
  nearEvent.launchTween = null;
}

export function getNearAttackTransform(nearEvent) {
  const halfLength = NEAR_ATTACK_PROFILE.range * 0.5;
  return {
    length: NEAR_ATTACK_PROFILE.range,
    width: NEAR_ATTACK_PROFILE.width,
    angle: nearEvent.angle,
    centerX: nearEvent.originX + nearEvent.dirX * halfLength,
    centerY: nearEvent.originY + nearEvent.dirY * halfLength,
  };
}

/**
 * 視覚・レーン用 OBB（パディングなし）。getNearAttackTransform と同じ center/angle/length/width。
 */
export function isPointInNearAttackLane(transform, worldX, worldY) {
  const halfLength = transform.length * 0.5;
  const halfWidth = transform.width * 0.5;
  const cos = Math.cos(transform.angle);
  const sin = Math.sin(transform.angle);
  const dx = worldX - transform.centerX;
  const dy = worldY - transform.centerY;
  const localX = (dx * cos) + (dy * sin);
  const localY = (-dx * sin) + (dy * cos);
  return Math.abs(localX) <= halfLength && Math.abs(localY) <= halfWidth;
}

function applyNearAttackDriftLane(scene, attack, dtMs) {
  const body = scene.player?.body;
  if (!body) return;
  const drift = NEAR_ATTACK_DRIFT;
  const transform = getNearAttackTransform(attack);
  const px = body.center.x;
  const py = body.center.y;
  if (!isPointInNearAttackLane(transform, px, py)) return;

  const dt = dtMs / 1000;
  const cos = Math.cos(transform.angle);
  const sin = Math.sin(transform.angle);
  const dx = px - transform.centerX;
  const dy = py - transform.centerY;
  const localY = (-dx * sin) + (dy * cos);

  body.velocity.x *= drift.frictionScale;
  body.velocity.y *= drift.frictionScale;

  body.velocity.x += cos * drift.assistForce * dt;
  body.velocity.y += sin * drift.assistForce * dt;

  const perpX = -sin;
  const perpY = cos;
  body.velocity.x += -localY * perpX * drift.centerPull * dt;
  body.velocity.y += -localY * perpY * drift.centerPull * dt;
}

export function applyNearAttackTransform(gameObject, nearEvent) {
  const transform = getNearAttackTransform(nearEvent);
  gameObject.setPosition(transform.centerX, transform.centerY);
  gameObject.setRotation(transform.angle);
}

export function applyNearAttackVisualTransform(gameObject, nearEvent) {
  gameObject.setPosition(nearEvent.originX, nearEvent.originY);
  gameObject.setRotation(nearEvent.angle);
}

export function emitNearAttackRectangle(scene, nearEvent) {
  const hitRect = scene.add.rectangle(
    0,
    0,
    NEAR_ATTACK_PROFILE.range,
    NEAR_ATTACK_PROFILE.width,
    0xffffff,
    1,
  )
    .setDepth(scene.player.depth + 4);
  hitRect.setOrigin(0.5, 0.5);
  hitRect.setFillStyle(0xffffff, 0);
  if (DEBUG_NEAR_ATTACK_HITBOX) {
    hitRect.setStrokeStyle(3, 0xff2bd6, 0.98);
  }
  applyNearAttackTransform(hitRect, nearEvent);
  return hitRect;
}

export function emitNearAttackLaserVisual(scene, nearEvent) {
  const visual = NEAR_ATTACK_VISUAL;
  const length = visual.laneLength;
  const halfBase = visual.laneWidth * 0.5;
  const halfTip = visual.laneTipWidth * 0.5;
  const lane = scene.add.polygon(
    0,
    0,
    [
      0, -halfBase,
      0, halfBase,
      length, halfTip,
      length, -halfTip,
    ],
    visual.laneColor,
    visual.laneAlpha,
  );
  lane.setOrigin(0, 0.5);
  lane.setDepth(scene.player.depth + 3);
  applyNearAttackVisualTransform(lane, nearEvent);
  return lane;
}

/**
 * プレイヤー中心から敵中心への方向と NEAR の dir の内積で前方を判定する。
 */
export function isEnemyInNearForwardDefenseSector(scene, nearEvent, enemy) {
  if (!scene?.player || !nearEvent || !enemy?.active) return false;
  const px = scene.player.body?.center?.x ?? scene.player.x;
  const py = scene.player.body?.center?.y ?? scene.player.y;
  const ex = enemy.body?.center?.x ?? enemy.x;
  const ey = enemy.body?.center?.y ?? enemy.y;
  let vx = ex - px;
  let vy = ey - py;
  const len = Math.hypot(vx, vy);
  if (len < 1e-4) return false;
  vx /= len;
  vy /= len;
  const dot = vx * nearEvent.dirX + vy * nearEvent.dirY;
  return dot >= NEAR_ATTACK_FRONT_CONTACT_TUNING.minForwardDot;
}

export function getNearAttackDirection(scene, preferredInputDir) {
  if (preferredInputDir && (preferredInputDir.x !== 0 || preferredInputDir.y !== 0)) {
    const len = Math.hypot(preferredInputDir.x, preferredInputDir.y);
    if (len > 0.0001) {
      return new Phaser.Math.Vector2(preferredInputDir.x / len, preferredInputDir.y / len);
    }
  }
  const vx = scene.player.body.velocity.x;
  const vy = scene.player.body.velocity.y;
  const speed = Math.hypot(vx, vy);
  if (speed > 0.0001) {
    return new Phaser.Math.Vector2(vx / speed, vy / speed);
  }
  return new Phaser.Math.Vector2(0, -1);
}

export function getNearAttackTrackingDirection(scene) {
  const desiredSpeed = scene.state.desiredVel.length();
  if (desiredSpeed > NEAR_ATTACK_VISUAL.minSteerSpeed) {
    return new Phaser.Math.Vector2(
      scene.state.desiredVel.x / desiredSpeed,
      scene.state.desiredVel.y / desiredSpeed,
    );
  }
  const vx = scene.player.body.velocity.x;
  const vy = scene.player.body.velocity.y;
  const speed = Math.hypot(vx, vy);
  if (speed > NEAR_ATTACK_VISUAL.minSteerSpeed) {
    return new Phaser.Math.Vector2(vx / speed, vy / speed);
  }
  return null;
}

export function updateNearAttack(scene, now, dtMs) {
  const attack = scene.activeNearAttack;
  if (!attack) return;
  if (now >= attack.endAt) {
    stopNearAttackLaunchTween(scene, attack);
    attack.hitRect?.destroy();
    attack.laserVisual?.destroy();
    scene.activeNearAttack = null;
    return;
  }

  if (now < attack.steerEndAt) {
    const targetDir = getNearAttackTrackingDirection(scene);
    if (targetDir) {
      const targetAngle = Math.atan2(targetDir.y, targetDir.x);
      const elapsed = now - attack.startedAt;
      const followWeight = Phaser.Math.Clamp(
        1 - (elapsed / Math.max(1, NEAR_ATTACK_VISUAL.steerDurationMs)),
        0,
        1,
      );
      const delta = Phaser.Math.Angle.Wrap(targetAngle - attack.angle);
      const steerStep = Phaser.Math.Clamp(
        delta * NEAR_ATTACK_VISUAL.steerLerp * followWeight,
        -NEAR_ATTACK_VISUAL.maxSteerStepRad,
        NEAR_ATTACK_VISUAL.maxSteerStepRad,
      );
      attack.angle = Phaser.Math.Angle.Wrap(
        attack.angle + steerStep,
      );
      attack.dirX = Math.cos(attack.angle);
      attack.dirY = Math.sin(attack.angle);
    }
  }

  if (attack.hitRect) applyNearAttackTransform(attack.hitRect, attack);
  if (attack.laserVisual) applyNearAttackVisualTransform(attack.laserVisual, attack);
  applyNearAttackDriftLane(scene, attack, dtMs ?? scene.game?.loop?.delta ?? 16);
  applyNearAttackDamage(scene, attack);
}

export function applyNearAttackDamage(scene, attack) {
  const damage = NEAR_ATTACK_PROFILE.damage;
  const transform = getNearAttackTransform(attack);
  const hitTuning = NEAR_ATTACK_HIT_TUNING;
  const halfLength = (transform.length * 0.5) + hitTuning.lengthPadding;
  const halfWidth = (transform.width * 0.5) + hitTuning.widthPadding;
  const cos = Math.cos(transform.angle);
  const sin = Math.sin(transform.angle);

  scene.enemies.getChildren().forEach((enemy) => {
    if (!enemy.active) return;
    if (attack.hitEnemyUids.has(enemy.uid)) return;
    const enemyCenterX = enemy.body?.center?.x ?? enemy.x;
    const enemyCenterY = enemy.body?.center?.y ?? enemy.y;
    const dx = enemyCenterX - transform.centerX;
    const dy = enemyCenterY - transform.centerY;
    const localX = (dx * cos) + (dy * sin);
    const localY = (-dx * sin) + (dy * cos);
    const enemyRadius = enemy.body?.halfWidth ?? ((enemy.displayWidth || enemy.width || 0) * 0.5);
    const enemyAllowance = Phaser.Math.Clamp(
      enemyRadius * hitTuning.enemyRadiusScale,
      hitTuning.enemyRadiusMin,
      hitTuning.enemyRadiusMax,
    );
    if (Math.abs(localX) > halfLength + enemyAllowance || Math.abs(localY) > halfWidth + enemyAllowance) return;

    attack.hitEnemyUids.add(enemy.uid);
    if (DEBUG_NEAR_ATTACK_HITBOX) {
      enemy.nearAttackHitUntil = scene.time.now + hitTuning.debugHitFlashMs;
      enemy.nearAttackHitStrength = 1;
    }
    enemy.hp -= damage;
    if (enemy.hp > 0) return;
    scene.addEnergyFromKill(enemy);
    scene.spawnXp(enemy.x, enemy.y);
    enemy.destroy();
  });
}

export function triggerNearAttack(scene, inputDir) {
  const dir = getNearAttackDirection(scene, inputDir);
  const prev = scene.activeNearAttack;
  if (prev) {
    stopNearAttackLaunchTween(scene, prev);
    prev.hitRect?.destroy();
    prev.laserVisual?.destroy();
  }
  const nearEvent = {
    originX: scene.player.x,
    originY: scene.player.y,
    dirX: dir.x,
    dirY: dir.y,
    angle: Math.atan2(dir.y, dir.x),
  };
  nearEvent.hitRect = emitNearAttackRectangle(scene, nearEvent);
  nearEvent.laserVisual = emitNearAttackLaserVisual(scene, nearEvent);
  nearEvent.startedAt = scene.time.now;
  nearEvent.endAt = nearEvent.startedAt + NEAR_ATTACK_VISUAL.durationMs;
  nearEvent.steerEndAt = nearEvent.startedAt + NEAR_ATTACK_VISUAL.steerDurationMs;
  nearEvent.hitEnemyUids = new Set();
  scene.activeNearAttack = nearEvent;

  const body = scene.player?.body;
  if (body) {
    const kick = NEAR_ATTACK_DRIFT.nearImpulse;
    body.velocity.x += dir.x * kick;
    body.velocity.y += dir.y * kick;
  }

  applyNearAttackDamage(scene, nearEvent);
}
