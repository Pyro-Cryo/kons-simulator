export enum GridOrigin {
  REVERSE_X = 0b01,
  REVERSE_Y = 0b10,
  UPPER_LEFT = 0,
  LOWER_LEFT = REVERSE_Y,
  UPPER_RIGHT = REVERSE_X,
  LOWER_RIGHT = REVERSE_X | REVERSE_Y,
}

/**
 * Abstraction of a canvas with an overlaid grid, to aid in rendering sprites
 * and shapes. The convention is that (x, y) is a position in canvas coordinates
 * (pixels), while (_x, _y) is a position in the grid. The x axis is horizontal
 * and the y axis vertical, but the grid origin can be configured.
 */
export class GameArea {
  readonly context: CanvasRenderingContext2D;
  private _gridWidth: number;
  private _gridHeight: number;
  /** True if `gridWidth` and `gridHeight` are both non-null. */
  public readonly usesGrid: boolean;
  private _unitWidth: number = 1;
  private _unitHeight: number = 1;
  private _scaleFactor: number = 1;
  // Draw offset in canvas units.
  private drawOffsetX: number = 0;
  private drawOffsetY: number = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    gridWidth: number | null,
    gridHeight: number | null,
    public gridOrigin = GridOrigin.UPPER_LEFT,
  ) {
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D rendering context from canvas');
    }
    this.context = context;

    if ((gridWidth === null) !== (gridHeight === null)) {
      throw new Error(
        `Either set both gridWidth and gridHeight to null, or neither: ` +
          `${gridWidth} x ${gridHeight}`
      );
    }
    this.usesGrid = gridWidth !== null && gridHeight !== null;

    if (this.usesGrid) {
      this._gridWidth = gridWidth!;
      this._gridHeight = gridHeight!;
      this.updateDerivedGridParameters();
    } else {
      this._gridWidth = this.canvas.width;
      this._gridHeight = this.canvas.width;
    }
  }

  set width(value) {
    this.canvas.width = value;
    if (this.usesGrid) {
      this.updateDerivedGridParameters();
    } else {
      this._gridWidth = value;
    }
  }
  get width() {
    return this.canvas.width;
  }

  set height(value) {
    this.canvas.height = value;
    if (this.usesGrid) {
      this.updateDerivedGridParameters();
    } else {
      this._gridHeight = value;
    }
  }
  get height() {
    return this.canvas.height;
  }

  get unitWidth() {
    return this._unitWidth;
  }

  get unitHeight() {
    return this._unitHeight;
  }

  get scaleFactor() {
    return this._scaleFactor;
  }

  set gridWidth(value) {
    this._gridWidth = value;
    if (this.usesGrid) {
      this.updateDerivedGridParameters();
    } else {
      this.canvas.width = value;
    }
  }
  get gridWidth() {
    return this._gridWidth;
  }

  set gridHeight(value) {
    this._gridHeight = value;
    if (this.usesGrid) {
      this.updateDerivedGridParameters();
    } else {
      this.canvas.height = value;
    }
  }
  get gridHeight() {
    return this._gridHeight;
  }

  private updateDerivedGridParameters() {
    this._unitWidth = Math.abs(this.gridToCanvasX(1) - this.gridToCanvasX(0));
    this._unitHeight = Math.abs(this.gridToCanvasY(1) - this.gridToCanvasY(0));
    this._scaleFactor = Math.sqrt(
      (Math.pow(this._unitWidth, 2) + Math.pow(this._unitHeight, 2)) / 2
    );
  }

  // + 0.5 var korrekt för campusdefence när vi ville att saker ritades i
  // mitten av tiles, men generellt rimligare att gridpunkten (0,0) är exakt
  // ett hörn
  gridToCanvasX(_x: number, considerOffset = true) {
    if (this.gridOrigin & GridOrigin.REVERSE_X)
      return (
        this.canvas.width * (1 - _x /* + 0.5*/ / this._gridWidth) -
        +considerOffset * this.drawOffsetX
      );
    else
      return (
        (this.canvas.width * _x) /* + 0.5*/ / this._gridWidth -
        +considerOffset * this.drawOffsetX
      );
  }
  gridToCanvasY(_y: number, considerOffset = true) {
    if (this.gridOrigin & GridOrigin.REVERSE_Y)
      return (
        this.canvas.height * (1 - _y /* + 0.5*/ / this._gridHeight) -
        +considerOffset * this.drawOffsetY
      );
    else
      return (
        (this.canvas.height * _y) /* + 0.5*/ / this._gridHeight -
        +considerOffset * this.drawOffsetY
      );
  }

  canvasToGridX(x: number, considerOffset = true) {
    if (this.gridOrigin & GridOrigin.REVERSE_X)
      return (
        (1 - (x + +considerOffset * this.drawOffsetX) / this.canvas.width) *
        this._gridWidth /* - 0.5*/
      );
    else
      return (
        ((x + +considerOffset * this.drawOffsetX) / this.canvas.width) *
        this._gridWidth /* - 0.5*/
      );
  }
  canvasToGridY(y: number, considerOffset = true) {
    if (this.gridOrigin & GridOrigin.REVERSE_Y)
      return (
        (1 - (y + +considerOffset * this.drawOffsetY) / this.canvas.height) *
        this._gridHeight /* - 0.5*/
      );
    else
      return (
        ((y + +considerOffset * this.drawOffsetY) / this.canvas.height) *
        this._gridHeight /* - 0.5*/
      );
  }

  get leftEdgeInGrid() {
    return this.canvasToGridX(0);
  }
  get rightEdgeInGrid() {
    return this.canvasToGridX(this.canvas.width);
  }

  get topEdgeInGrid() {
    return this.canvasToGridY(0);
  }
  get bottomEdgeInGrid() {
    return this.canvasToGridY(this.canvas.height);
  }

  resetDrawOffset(x = true, y = true) {
    if (x) this.drawOffsetX = 0;
    if (y) this.drawOffsetY = 0;
  }

  centerCameraOn(
    _x: number,
    _y: number,
    horizontally = true,
    vertically = true
  ) {
    if (horizontally)
      this.drawOffsetX = this.gridToCanvasX(_x, false) - this.canvas.width / 2;
    if (vertically)
      this.drawOffsetY = this.gridToCanvasY(_y, false) - this.canvas.height / 2;
  }

  keepInFrame(
    _x: number,
    _y: number,
    width: number = 0,
    height: number | null = null,
    marginTop: number = 0,
    marginRight: number | null = null,
    marginBottom: number | null = null,
    marginLeft: number | null = null
  ) {
    if (height === null) height = width;
    if (marginRight === null) marginRight = marginTop;
    if (marginBottom === null) marginBottom = marginTop;
    if (marginLeft === null) marginLeft = marginRight;

    const xLeft = this.gridToCanvasX(_x, false) - (width * this._unitWidth) / 2;
    const xRight =
      this.gridToCanvasX(_x, false) + (width * this._unitWidth) / 2;
    const yTop = this.gridToCanvasY(_y, false) - (height * this._unitWidth) / 2;
    const yBottom =
      this.gridToCanvasY(_y, false) + (height * this._unitWidth) / 2;

    if (xLeft - this.drawOffsetX < marginLeft)
      this.drawOffsetX = xLeft - marginLeft;
    else if (this.canvas.width - (xRight - this.drawOffsetX) < marginRight)
      this.drawOffsetX = xRight - (this.canvas.width - marginRight);
    if (yTop - this.drawOffsetY < marginTop)
      this.drawOffsetY = yTop - marginTop;
    else if (this.canvas.height - (yBottom - this.drawOffsetY) < marginBottom)
      this.drawOffsetY = yBottom - (this.canvas.height - marginBottom);
  }

  /**
   * Checks whether any part of a rectangle would be visible when drawn.
   * @param _x x position of the center in grid coordinates
   * @param _y y position of the center in grid coordinates
   * @param width width in grid units
   * @param height height in grid units
   * @param widthHeightIsCanvasUnits whether the width and height are
   *    given in canvas units
   */
  isInFrame(
    _x: number,
    _y: number,
    width: number = 0,
    height: number | null = null,
    widthHeightIsCanvasUnits: boolean = false
  ) {
    if (height === null) height = width;
    if (!widthHeightIsCanvasUnits) {
      width *= this._unitWidth;
      height *= this._unitHeight;
    }

    return (
      this.gridToCanvasX(_x) + width / 2 >= 0 &&
      this.gridToCanvasX(_x) - width / 2 < this.canvas.width &&
      this.gridToCanvasY(_y) + height / 2 >= 0 &&
      this.gridToCanvasY(_y) - height / 2 < this.canvas.height
    );
  }

  clear() {
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draws an image centered around (x, y) with the specified angle (in radians)
   * and scale.
   */
  draw(
    image: ImageBitmap | HTMLCanvasElement,
    _x: number,
    _y: number,
    angle: number = 0,
    scale: number = 1,
    considerOffset = true
  ) {
    const x = this.gridToCanvasX(_x, considerOffset);
    const y = this.gridToCanvasY(_y, considerOffset);
    if (!angle) {
      if (scale === 1)
        this.context.drawImage(
          image,
          Math.floor(x - image.width / 2),
          Math.floor(y - image.height / 2)
        );
      else
        this.context.drawImage(
          image,
          Math.floor(x - (image.width * scale) / 2),
          Math.floor(y - (image.height * scale) / 2),
          Math.floor(image.width * scale),
          Math.floor(image.height * scale)
        );
    } else {
      this.context.save();
      this.context.translate(Math.floor(x), Math.floor(y));
      this.context.rotate(angle);
      if (scale === 1)
        this.context.drawImage(
          image,
          -Math.floor(image.width / 2),
          -Math.floor(image.height / 2)
        );
      else
        this.context.drawImage(
          image,
          -Math.floor((image.width * scale) / 2),
          -Math.floor((image.height * scale) / 2),
          Math.floor(image.width * scale),
          Math.floor(image.height * scale)
        );
      this.context.restore();
    }
  }

  /**
   * Draws a subimage from an image, centered around (x, y) with the specified
   * angle (in radians) and scale.
   */
  drawSubimage(
    image: ImageBitmap | HTMLCanvasElement,
    subimageIndex: number,
    subimageWidth: number,
    _x: number,
    _y: number,
    angle: number = 0,
    scale: number = 1,
    considerOffset: boolean = true
  ) {
    const x = this.gridToCanvasX(_x, considerOffset);
    const y = this.gridToCanvasY(_y, considerOffset);
    if (!angle) {
      this.context.drawImage(
        image,
        subimageIndex * subimageWidth,
        0,
        subimageWidth,
        image.height,
        x - (subimageWidth * scale) / 2,
        y - (image.height * scale) / 2,
        image.width * scale,
        image.height * scale
      );
    } else {
      this.context.translate(x, y);
      this.context.rotate(angle);
      this.context.drawImage(
        image,
        subimageIndex * subimageWidth,
        0,
        subimageWidth,
        image.height,
        (-subimageWidth * scale) / 2,
        (-image.height * scale) / 2,
        subimageWidth * scale,
        image.height * scale
      );
      this.context.rotate(-angle);
      this.context.translate(-x, -y);
    }
  }

  disc(
    _x: number,
    _y: number,
    radius: number = 1,
    color: string = '#000000',
    considerOffset: boolean = true
  ) {
    const x = this.gridToCanvasX(_x, considerOffset);
    const y = this.gridToCanvasY(_y, considerOffset);
    const fillStyle = this.context.fillStyle;
    this.context.fillStyle = color;
    this.context.beginPath();
    this.context.arc(x, y, radius * this._scaleFactor, 0, 2 * Math.PI);
    this.context.fill();
    this.context.fillStyle = fillStyle;
  }

  square(
    _x: number,
    _y: number,
    side: number = 1,
    color: string = '#000000',
    considerOffset: boolean = true
  ) {
    this.rect(_x, _y, side, side, color, considerOffset);
  }

  rect(
    _x: number,
    _y: number,
    width: number = 1,
    height: number = 1,
    color: string = '#000000',
    considerOffset: boolean = true
  ) {
    const x = this.gridToCanvasX(_x, considerOffset) - width / 2;
    const y = this.gridToCanvasY(_y, considerOffset) - height / 2;
    const fillStyle = this.context.fillStyle;
    this.context.fillStyle = color;
    this.context.fillRect(
      x,
      y,
      width * this.unitWidth,
      height * this.unitHeight
    );
    this.context.fillStyle = fillStyle;
  }

  bar(
    _x: number,
    _y: number,
    offset: number,
    length: number,
    width: number,
    ratio: number,
    fgColor: string = '#FF0000',
    bgColor: string = '#00FF00',
    considerOffset: boolean = true
  ) {
    const x = this.gridToCanvasX(_x, considerOffset);
    const y = this.gridToCanvasY(_y, considerOffset);
    offset *= this.unitHeight;
    length *= this.unitWidth;
    const fillStyle = this.context.fillStyle;
    this.context.fillStyle = bgColor;
    this.context.fillRect(x - length / 2, y + offset, length, width);
    this.context.fillStyle = fgColor;
    this.context.fillRect(x - length / 2, y + offset, length * ratio, width);
    this.context.fillStyle = fillStyle;
  }

  line(
    _x0: number,
    _y0: number,
    _x1: number,
    _y1: number,
    linewidth: number = 1,
    color: string = 'black',
    considerOffset: boolean = true
  ) {
    this.context.beginPath();
    this.context.strokeStyle = color;
    this.context.lineWidth = linewidth;
    this.context.moveTo(
      this.gridToCanvasX(_x0, considerOffset),
      this.gridToCanvasY(_y0, considerOffset)
    );
    this.context.lineTo(
      this.gridToCanvasX(_x1, considerOffset),
      this.gridToCanvasY(_y1, considerOffset)
    );
    this.context.stroke();
  }

  /**
   * Draw some text
   * @param _x Horizontal position in grid coords
   * @param _y Vertical position in grid coords
   * @param str The text to draw
   * @param font Either a font size or a whole CSS font specification.
   * @param color The color to draw the text in
   * @param alignment Text alignment (`"center"`, `"left"`, or `"right"`)
   * @param baseline Baseline of the text when drawn, see
   *    https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
   * @param considerOffset `true` if camera offset should be used,
   *    `false` if offsets should be taken as zero
   */
  text(
    _x: number,
    _y: number,
    str: string,
    font: string = '16px sans',
    color: string = 'black',
    alignment: CanvasTextAlign = 'center',
    baseline?: CanvasTextBaseline,
    considerOffset: boolean = true
  ) {
    const x = this.gridToCanvasX(_x, considerOffset);
    const y = this.gridToCanvasY(_y, considerOffset);
    this.context.save();
    if (typeof font === 'number') font = font + 'px sans';
    this.context.font = font;
    this.context.fillStyle = color;
    this.context.textAlign = alignment;
    if (baseline) this.context.textBaseline = baseline;
    this.context.fillText(str, x, y);
    this.context.restore();
  }
}
