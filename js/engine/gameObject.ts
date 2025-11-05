import {Controller} from './controller.js';
import {Asset} from './resource.js';
import type {Drawable, GameArea} from './gameArea.js';

/**
 * Represents an object with a sprite that can be rotated, scaled or otherwise
 * updated.
 */
export class PrerenderedObject {
  /** Default value for the object's sprite. */
  static readonly IMAGE: Drawable | Asset<Drawable> | null = null;
  private _image: Drawable | null;

  /** Default value for the object's sprite's angle, in radians. */
  static readonly ANGLE: number = 0;
  private _angle: number;

  /**
   * Default value for the minimum angle change for the object to be
   * re-rendered.
   */
  static readonly ANGLE_DELTA_DEGREES: number = 5;
  /** The minimum angle change for the object to be re-rendered. */
  angleDeltaDegrees: number;

  /** Default value for the object's sprite's scale. */
  static readonly SCALE: number = 1;
  private _scale: number;

  /** Default value for the object's opacity, in the range [0, 1]. */
  static readonly ALPHA: number = 1;
  private _alpha: number;

  // private _mirror: boolean = false;

  private _lastDrawnAngle: number | null = null;
  private _imageDirty: boolean = true;
  private imagecache: HTMLCanvasElement | null = null;
  private imagecontext: CanvasRenderingContext2D | null = null;

  // TODO: Add mirroring logic if needed
  constructor() {
    const constructor = this.constructor as typeof PrerenderedObject;
    let image = constructor.IMAGE;
    if (image instanceof Asset) {
      image = image.get();
    }
    this._image = image;
    this._angle = constructor.ANGLE;
    this.angleDeltaDegrees = constructor.ANGLE_DELTA_DEGREES;
    this._scale = constructor.SCALE;
    this._alpha = constructor.ALPHA;
  }

  set image(value) {
    if (value !== this._image) {
      this._image = value;
      this._imageDirty = true;
    }
  }
  /** The object's sprite. */
  get image() {
    return this._image;
  }

  set scale(value) {
    if (value !== this._scale) {
      this._scale = value;
      this._imageDirty = true;
    }
  }
  /** The object's sprite's angle, in radians. */
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
  /** The minimum angle change for the object to be re-rendered. */
  get angle() {
    return this._angle;
  }

  set alpha(value) {
    if (value !== this._alpha) {
      this._alpha = value;
      this._imageDirty = true;
    }
  }
  /** The object's opacity, in the range [0, 1]. */
  get alpha() {
    return this._alpha;
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
  draw(gameArea: GameArea, x: number, y: number) {
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
    if (!this.imagecache) {
      this.imagecache = document.createElement('canvas');
    } else {
      this.imagecontext!.clearRect(
        0,
        0,
        this.imagecache.width,
        this.imagecache.height
      );
    }

    const sin = Math.sin(this._angle);
    const cos = Math.cos(this._angle);
    this.imagecache.height = Math.ceil(
      (this.image.height * Math.abs(cos) + this.image.width * Math.abs(sin)) *
        this.scale
    );
    this.imagecache.width = Math.ceil(
      (this.image.height * Math.abs(sin) + this.image.width * Math.abs(cos)) *
        this.scale
    );
    this.imagecontext = this.imagecache.getContext('2d')!;

    this.imagecontext.translate(
      this.imagecache.width / 2,
      this.imagecache.height / 2
    );
    this.imagecontext.rotate(this._angle);
    if (this._alpha !== 1) {
      this.imagecontext.globalAlpha = this._alpha;
    }

    // if (this.mirror) {
    // 	this.imagecontext.translate(this.imagecache.width, 0);
    // 	this.imagecontext.scale(-1, 1);
    // }

    this.imagecontext.drawImage(
      this.image,
      (-this.image.width * this._scale) / 2,
      (-this.image.height * this._scale) / 2,
      this.image.width * this._scale,
      this.image.height * this._scale
    );

    this._imageDirty = false;
    this._lastDrawnAngle = this._angle;
  }
}

export class GameObject extends PrerenderedObject {
  id: number | null = null;
  despawnTimer: number = -1;

  constructor(public x: number, public y: number, register = true) {
    super();
    if (register) {
      this.register();
    }
  }

  collisionCheckRectangular(other: GameObject) {
    return (
      this.width !== null &&
      this.height !== null &&
      other.width !== null &&
      other.height !== null &&
      Math.abs(this.x - other.x) <= (this.width + other.width) / 2 &&
      Math.abs(this.y - other.y) <= (this.height + other.height) / 2
    );
  }

  update(delta: number) {
    if (this.despawnTimer >= 0) {
      this.despawnTimer -= delta;
      if (this.despawnTimer <= 0) this.despawn();
    }
  }

  translate(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
  }

  /**
   * Draw the object
   */
  draw(gameArea: GameArea) {
    super.draw(gameArea, this.x, this.y);
  }

  register() {
    Controller.instance.registerObject(this);
  }

  despawn() {
    this.id = null;
  }
}

export class EffectObject extends GameObject {
  /** Status effects currently affecting this object. */
  effects: Set<BaseEffect> = new Set();

  override update(delta: number) {
    // Apply status effects
    this.effects.forEach((obj) => obj.update(this, delta));
    super.update(delta);
  }

  override draw(gameArea: GameArea) {
    let index = 0;
    this.effects.forEach((obj) => {
      if ((obj.constructor as typeof BaseEffect).DRAW_BEFORE) {
        obj.drawRelative(this, gameArea, index);
      }
      index++;
    });

    super.draw(gameArea);

    index = 0;
    this.effects.forEach((obj) => {
      if (!(obj.constructor as typeof BaseEffect).DRAW_BEFORE) {
        obj.drawRelative(this, gameArea, index);
      }
      index++;
    });
  }

  addEffect(newEffect: BaseEffect) {
    for (
      let it = this.effects.values(), effect = null;
      (effect = it.next().value);

    ) {
      if (effect.constructor === effect.constructor) {
        effect.cdtime = effect.cooldown;
        return;
      }
    }

    this.effects.add(newEffect);
    newEffect.init(this);
  }

  removeEffect(effect: BaseEffect) {
    this.effects.delete(effect);
  }
}

export class BaseEffect extends PrerenderedObject {
  static readonly STACKABLE: boolean = false;
  static readonly MAX_INVOCATIONS: number = 10;
  /** px offset från parent object för att rita img. null för default värde. */
  static readonly IMAGE_OFFSET: [number | null, number | null] = [null, null];
  private imageOffset: [number | null, number | null];
  /** Cooldown i millisekunder. */
  static readonly COOLDOWN: number = 1000;
  cooldown: number;
  /** Ifall effekten ska ritas ut innan (bakom) objektet det hör till. */
  static readonly DRAW_BEFORE: boolean = false;

  cdtime: number;
  private timesInitialized: number = 0;
  private invocations: number = 0;

  constructor() {
    super();
    const constructor = this.constructor as typeof BaseEffect;
    this.cooldown = constructor.COOLDOWN;
    this.cdtime = this.cooldown;
    this.imageOffset = constructor.IMAGE_OFFSET;
  }

  init(object: EffectObject) {
    this.timesInitialized++;
  }

  update(object: EffectObject, delta: number) {
    this.cdtime -= delta;
    if (this.cdtime <= 0) {
      this.cdtime += this.cooldown;
      this.apply(object);

      if (
        ++this.invocations >=
        (this.constructor as typeof BaseEffect).MAX_INVOCATIONS
      )
        this.remove(object);
    }
  }

  drawRelative(object: EffectObject, gameArea: GameArea, index: number) {
    const x = object.x + (this.imageOffset[0] ?? 0.5 - 0.3 * index);
    const y = object.y + (this.imageOffset[1] ?? -0.5);

    super.draw(gameArea, x, y);
  }

  apply(object: EffectObject) {}

  remove(object: EffectObject) {
    object.removeEffect(this);
  }
}
