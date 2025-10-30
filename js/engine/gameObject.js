'use strict';

/**
 * Represents an object with a sprite that can be rotated, scaled or otherwise
 * updated.
 */
class PrerenderedObject {
  // The object's sprite
  static get image() {
    return null;
  }
  // The object's sprite's default angle, in radians.
  static get angle() {
    return 0;
  }
  // The minimum angle change for the object to be re-rendered
  static get angleDeltaDegrees() {
    return 5;
  }
  // The object's sprite's scale
  static get scale() {
    return 1;
  }

  // TODO: Add mirroring logic if needed
  constructor(
    image = null,
    angle = null,
    scale = null,
    angleDeltaDegrees = null
  ) {
    this.image = image === null ? this.constructor.image : image;
    this._lastDrawnAngle = null;
    this.angle = angle === null ? this.constructor.angle : angle;
    this.scale = scale === null ? this.constructor.scale : scale;
    this.angleDeltaDegrees =
      angleDeltaDegrees === null
        ? this.constructor.angleDeltaDegrees
        : angleDeltaDegrees;
    this.alpha = 1;
    // this._mirror = false;
    // this.mirror = false;

    this._imageDirty = true;
    this.imagecache = null;
    this.imagecontext = null;
  }

  set image(value) {
    if (value !== this._image) {
      this._image = value;
      this._imageDirty = true;
    }
  }
  get image() {
    return this._image;
  }

  set scale(value) {
    if (value !== this._scale) {
      this._scale = value;
      this._imageDirty = true;
    }
  }
  get scale() {
    return this._scale;
  }

  set angle(value) {
    //if (Math.abs(value) > Math.PI / 2)
    //	value -= Math.sign(value) * Math.PI;

    this._angle = value;
    if (
      this._lastDrawnAngle !== null &&
      Math.abs(this._angle - this._lastDrawnAngle) <
        (this.angleDeltaDegrees * Math.PI) / 180
    )
      return;
    this._imageDirty = true;
  }
  get angle() {
    return this._angle;
  }

  // set mirror(value) {
  // 	if (this._mirror === value)
  // 		return;
  // 	this._mirror = value;
  // 	this._imageDirty = true;
  // }
  // get mirror() {
  // 	return this._mirror;
  // }

  get width() {
    if (this._imageDirty) this.prerender();
    if (this.imagecache === null) return null;
    return this.imagecache.width / Controller.instance.gameArea.unitWidth;
  }
  get height() {
    if (this._imageDirty) this.prerender();
    if (this.imagecache === null) return null;
    return this.imagecache.height / Controller.instance.gameArea.unitHeight;
  }

  /**
   * Draw the object, re-rendering it if dirty
   * @param {GameArea} gameArea
   * @param {Number} x
   * @param {Number} y
   */
  draw(gameArea, x, y) {
    if (this._imageDirty) this.prerender();
    if (this.imagecache === null) return;
    if (this.imagecache.width === 0 || this.imagecache.height === 0) return;
    gameArea.draw(this.imagecache, x, y, 0, 1);
  }

  /**
   * Render the sprite so that it can be drawn without any overhead.
   */
  prerender() {
    if (
      this.image === null ||
      (this.image instanceof Image && !this.image.complete)
    ) {
      this.imagecache = null;
      console.warn('Trying to prerender null or non-loaded object');
      return;
    } else if (!this.image.width || !this.image.height) {
      this.imagecache = null;
      console.warn(
        `Trying to prerender ${this.image.width} x ${this.image.height} image`
      );
      return;
    }
    if (!this.imagecache) this.imagecache = document.createElement('canvas');
    else
      this.imagecontext.clearRect(
        0,
        0,
        this.imagecache.width,
        this.imagecache.height
      );

    this.imagecache.height = Math.ceil(
      (this.image.height * Math.abs(Math.cos(this.angle)) +
        this.image.width * Math.abs(Math.sin(this.angle))) *
        this.scale
    );
    this.imagecache.width = Math.ceil(
      (this.image.height * Math.abs(Math.sin(this.angle)) +
        this.image.width * Math.abs(Math.cos(this.angle))) *
        this.scale
    );
    this.imagecontext = this.imagecache.getContext('2d');

    this.imagecontext.translate(
      this.imagecache.width / 2,
      this.imagecache.height / 2
    );
    this.imagecontext.rotate(this.angle);
    if (this.alpha !== 1) this.imagecontext.globalAlpha = this.alpha;

    // if (this.mirror) {
    // 	this.imagecontext.translate(this.imagecache.width, 0);
    // 	this.imagecontext.scale(-1, 1);
    // }

    this.imagecontext.drawImage(
      this.image,
      (-this.image.width * this.scale) / 2,
      (-this.image.height * this.scale) / 2,
      this.image.width * this.scale,
      this.image.height * this.scale
    );

    this._imageDirty = false;
    this._lastDrawnAngle = this.angle;
  }
}

class GameObject extends PrerenderedObject {
  constructor(x, y, image = null, angle = null, scale = null, register = true) {
    super(image, angle, scale);
    this.x = x;
    this.y = y;
    this.id = null;

    // this.physics = new PhysicsNull(this);	// Alla gameobjects har ett
		// physics object, men default är ingen fysik.

    this.despawnTimer = -1;

    if (register) this.register();
  }

  // get vx() { return this.physics.vx; }
  // set vx(v) { this.physics.vx = v; }
  // get vy() { return this.physics.vy; }
  // set vy(v) { this.physics.vy = v; }

  collisionCheckRectangular(other) {
    return (
      Math.abs(this.x - other.x) <= (this.width + other.width) / 2 &&
      Math.abs(this.y - other.y) <= (this.height + other.height) / 2
    );
  }

  update(delta) {
    if (this.despawnTimer >= 0) {
      this.despawnTimer -= delta;
      if (this.despawnTimer <= 0) this.despawn();
    }
    // this.physics.move(delta);
  }

  translate(dx, dy) {
    this.x += dx;
    this.y += dy;
  }

  /**
   * Draw the object
   * @param {GameArea} gameArea
   */
  draw(gameArea) {
    super.draw(gameArea, this.x, this.y);
  }

  register() {
    Controller.instance.registerObject(this);
  }

  despawn() {
    this.id = null;
  }
}

class EffectObject extends GameObject {
  constructor(x, y, image = null, angle = null, scale = null, register = true) {
    super(x, y, image, angle, scale, register);
    // Status effects currently affecting this object
    this.effects = new Set();
  }

  update(delta) {
    // Apply status effects
    this.effects.forEach(
      function (obj) {
        obj.update(this, delta);
      }.bind(this)
    );

    super.update(delta);
  }

  draw(gameArea) {
    let index = 0;
    this.effects.forEach(
      function (obj) {
        if (obj.constructor.drawBefore) obj.draw(this, gameArea, index);
        index++;
      }.bind(this)
    );

    super.draw(gameArea);

    index = 0;
    this.effects.forEach(
      function (obj) {
        if (!obj.constructor.drawBefore) obj.draw(this, gameArea, index);
        index++;
      }.bind(this)
    );
  }

  addEffect(effect) {
    for (
      var it = this.effects.values(), val = null;
      (val = it.next().value);

    ) {
      if (val.constructor === effect.constructor) {
        val.cdtime = effect.cooldown;
        return;
      }
    }

    this.effects.add(effect);
    effect.init(this);
  }

  removeEffect(effect) {
    this.effects.delete(effect);
  }
}

class BaseEffect extends PrerenderedObject {
  static get stackable() {
    return false;
  }
  static get maxInvocations() {
    return 10;
  }
  // px offset från parent object för att rita img. null för default värde.
  static get imgOffset() {
    return [null, null];
  }
  static get cooldown() {
    return 1000;
  }
  static get drawBefore() {
    return false;
  }

  constructor() {
    super();

    this.cooldown = this.constructor.cooldown;
    this.cdtime = this.cooldown;
    this.timesinitialized = 0;
    this.imgOffset = this.constructor.imgOffset;

    this.invocations = 0;
  }

  init(object) {
    this.timesinitialized++;
  }

  update(object, delta) {
    this.cdtime -= delta;
    if (this.cdtime <= 0) {
      this.cdtime += this.cooldown;
      this.apply(object);

      if (++this.invocations >= this.constructor.maxInvocations)
        this.remove(object);
    }
  }

  draw(object, gameArea, index) {
    let x =
      object.x +
      (this.imgOffset[0] === null ? 0.5 - 0.3 * index : this.imgOffset[0]);
    let y = object.y + (this.imgOffset[1] === null ? -0.5 : this.imgOffset[1]);

    super.draw(gameArea, x, y);
  }

  apply(object) {}

  remove(object) {
    object.removeEffect(this);
  }
}
