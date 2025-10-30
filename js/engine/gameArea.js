let _GameArea__GRID_ORIGIN_REVERSE_X = 0b01;
let _GameArea__GRID_ORIGIN_REVERSE_Y = 0b10;
let _GameArea_GRID_ORIGIN_UPPER_LEFT = 0;
let _GameArea_GRID_ORIGIN_LOWER_LEFT = _GameArea__GRID_ORIGIN_REVERSE_Y;
let _GameArea_GRID_ORIGIN_UPPER_RIGHT = _GameArea__GRID_ORIGIN_REVERSE_X;
let _GameArea_GRID_ORIGIN_LOWER_RIGHT =
  _GameArea__GRID_ORIGIN_REVERSE_X | _GameArea__GRID_ORIGIN_REVERSE_Y;

export class GameArea {
  static get _GRID_ORIGIN_REVERSE_X() {
    return _GameArea__GRID_ORIGIN_REVERSE_X;
  }
  static get _GRID_ORIGIN_REVERSE_Y() {
    return _GameArea__GRID_ORIGIN_REVERSE_Y;
  }
  static get GRID_ORIGIN_UPPER_LEFT() {
    return _GameArea_GRID_ORIGIN_UPPER_LEFT;
  }
  static get GRID_ORIGIN_LOWER_LEFT() {
    return _GameArea_GRID_ORIGIN_LOWER_LEFT;
  }
  static get GRID_ORIGIN_UPPER_RIGHT() {
    return _GameArea_GRID_ORIGIN_UPPER_RIGHT;
  }
  static get GRID_ORIGIN_LOWER_RIGHT() {
    return _GameArea_GRID_ORIGIN_LOWER_RIGHT;
  }

  constructor(
    canvas,
    gridWidth,
    gridHeight,
    gridOrigin = GameArea.GRID_ORIGIN_UPPER_LEFT
  ) {
    this.canvas = canvas;
    /** @type {CanvasRenderingContext2D} */
    this.context = this.canvas.getContext('2d');
    this.gridOrigin = gridOrigin;

    // Draw offset in canvas units
    this.drawOffsetX = 0;
    this.drawOffsetY = 0;

    if (gridWidth === null && gridHeight === null) {
      this._usesGrid = false;
      this._gridWidth = this.canvas.width;
      this._gridHeight = this.canvas.height;

      this._unitWidth = 1;
      this._unitHeight = 1;
      this._scaleFactor = 1;
    } else if (gridWidth !== null && gridHeight !== null) {
      this._usesGrid = true;
      this._gridWidth = gridWidth;
      this._gridHeight = gridHeight;

      this._unitWidth = Math.abs(this.gridToCanvasX(1) - this.gridToCanvasX(0));
      this._unitHeight = Math.abs(
        this.gridToCanvasY(1) - this.gridToCanvasY(0)
      );
      this._scaleFactor = Math.sqrt(
        (Math.pow(this.unitWidth, 2) + Math.pow(this.unitHeight, 2)) / 2
      );
    } else {
      throw new Error(
        `Either set both gridWidth and gridHeight to null, or neither: ` +
          `${gridWidth} x ${gridHeight}`
      );
    }
  }

  set width(value) {
    this.canvas.width = value;
    if (!this.usesGrid) this._gridWidth = value;
  }
  get width() {
    return this.canvas.width;
  }

  set height(value) {
    this.canvas.height = value;
    if (!this.usesGrid) this._gridHeight = value;
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

  get usesGrid() {
    return this._usesGrid;
  }

  set gridWidth(value) {
    this._gridWidth = value;
    if (!this._usesGrid) this.canvas.width = value;
  }
  get gridWidth() {
    return this._gridWidth;
  }

  set gridHeight(value) {
    this._gridHeight = value;
    if (!this._usesGrid) this.canvas.height = value;
  }
  get gridHeight() {
    return this._gridHeight;
  }

  // + 0.5 var korrekt för campusdefence när vi ville att saker ritades i
  // mitten av tiles, men generellt rimligare att gridpunkten (0,0) är exakt
  // ett hörn
  gridToCanvasX(x, considerOffset = true) {
    if (this.gridOrigin & GameArea._GRID_ORIGIN_REVERSE_X)
      return (
        this.canvas.width * (1 - x /* + 0.5*/ / this._gridWidth) -
        considerOffset * this.drawOffsetX
      );
    else
      return (
        (this.canvas.width * x) /* + 0.5*/ / this._gridWidth -
        considerOffset * this.drawOffsetX
      );
  }
  gridToCanvasY(y, considerOffset = true) {
    if (this.gridOrigin & GameArea._GRID_ORIGIN_REVERSE_Y)
      return (
        this.canvas.height * (1 - y /* + 0.5*/ / this._gridHeight) -
        considerOffset * this.drawOffsetY
      );
    else
      return (
        (this.canvas.height * y) /* + 0.5*/ / this._gridHeight -
        considerOffset * this.drawOffsetY
      );
  }

  canvasToGridX(x, considerOffset = true) {
    if (this.gridOrigin & GameArea._GRID_ORIGIN_REVERSE_X)
      return (
        (1 - (x + considerOffset * this.drawOffsetX) / this.canvas.width) *
        this._gridWidth /* - 0.5*/
      );
    else
      return (
        ((x + considerOffset * this.drawOffsetX) / this.canvas.width) *
        this._gridWidth /* - 0.5*/
      );
  }
  canvasToGridY(y, considerOffset = true) {
    if (this.gridOrigin & GameArea._GRID_ORIGIN_REVERSE_Y)
      return (
        (1 - (y + considerOffset * this.drawOffsetY) / this.canvas.height) *
        this._gridHeight /* - 0.5*/
      );
    else
      return (
        ((y + considerOffset * this.drawOffsetY) / this.canvas.height) *
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

  centerCameraOn(_x, _y, horizontally = true, vertically = true) {
    if (horizontally)
      this.drawOffsetX = this.gridToCanvasX(_x, false) - this.canvas.width / 2;
    if (vertically)
      this.drawOffsetY = this.gridToCanvasY(_y, false) - this.canvas.height / 2;
  }

  keepInFrame(
    _x,
    _y,
    width = 0,
    height = null,
    marginTop = 0,
    marginRight = null,
    marginBottom = null,
    marginLeft = null
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
   * @param {Number} _x x position of the center in grid coordinates
   * @param {Number} _y y position of the center in grid coordinates
   * @param {Number} width width in grid units
   * @param {Number} height height in grid units
   * @param {boolean} widthHeightIsCanvasUnits whether the width and height are
   *    given in canvas units
   */
  isInFrame(
    _x,
    _y,
    width = 0,
    height = null,
    widthHeightIsCanvasUnits = false
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

  // Draws an image centered around (x, y) with the specified angle (in radians)
  // and scale
  draw(image, _x, _y, angle, scale, considerOffset = true) {
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

  // Draws a subimage from an image, centered around (x, y) with the specified
  // angle (in radians) and scale
  drawSubimage(
    image,
    subimageIndex,
    subimageWidth,
    _x,
    _y,
    angle,
    scale,
    considerOffset
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

  disc(_x, _y, radius = 1, color = '#000000', considerOffset = true) {
    const x = this.gridToCanvasX(_x, considerOffset);
    const y = this.gridToCanvasY(_y, considerOffset);
    const fillStyle = this.context.fillStyle;
    this.context.fillStyle = color;
    this.context.beginPath();
    this.context.arc(x, y, radius * this._scaleFactor, 0, 2 * Math.PI);
    this.context.fill();
    this.context.fillStyle = fillStyle;
  }

  square(_x, _y, side = 1, color = '#000000', considerOffset = true) {
    this.rect(_x, _y, side, side, color, considerOffset);
  }

  rect(
    _x,
    _y,
    width = 1,
    height = 1,
    color = '#000000',
    considerOffset = true
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
    _x,
    _y,
    offset,
    length,
    width,
    ratio,
    fgColor = '#FF0000',
    bgColor = '#00FF00',
    considerOffset = true
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
    _x0,
    _y0,
    _x1,
    _y1,
    linewidth = 1,
    color = 'black',
    considerOffset = true
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
   * @param {number} _x Horizontal position in grid coords
   * @param {number} _y Vertical position in grid coords
   * @param {string} str The text to draw
   * @param {number | string} font Either a font size or a whole CSS font
   *    specification.
   * @param {string} color The color to draw the text in
   * @param {string} alignment Text alignment (`"center"`, `"left"`, or
   *    `"right"`)
   * @param {string} baseline Baseline of the text when drawn, see
   *    https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
   * @param {boolean} considerOffset `true` if camera offset should be used,
   *    `false` if offsets should be taken as zero
   */
  text(
    _x,
    _y,
    str,
    font = '16px sans',
    color = 'black',
    alignment = 'center',
    baseline = null,
    considerOffset = true
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
