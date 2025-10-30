let _Splines_pascalTriangle = [[1], [1, 1]];
let _Splines_ENDPOINT_SAME = 0;
let _Splines_ENDPOINT_EXTRAPOLATE = 1;
let _Splines_DERIVATIVE_MIDPOINT = 0;
let _Splines_DERIVATIVE_BACKWARD = 1;
let _Splines_DERIVATIVE_FORWARD = 2;
let _Splines_DERIVATIVE_OUT = 3;
let _Splines_DERIVATIVE_ZERO = 4;

export class Splines {
  static get pascalTriangle() {
    return _Splines_pascalTriangle;
  }
  static set pascalTriangle(value) {
    _Splines_pascalTriangle = value;
  }
  static nChooseK(n, k) {
    while (this.pascalTriangle.length <= n) {
      const currentN = this.pascalTriangle.length;
      let row = new Array(currentN + 1).fill(1);
      for (let i = 1; i < currentN; i++)
        row[i] =
          this.pascalTriangle[currentN - 1][i - 1] +
          this.pascalTriangle[currentN - 1][i];

      this.pascalTriangle.push(row);
    }

    return this.pascalTriangle[n][k];
  }

  static _check(t, upperBound) {
    if (!(t >= 0 && t <= upperBound))
      throw new Error(
        't out of bounds [0, ' + upperBound + '] with value ' + t
      );
  }

  /**
   * Interprets the path as a degree {path.length - 1} Bezier curve and
   * interpolates along it.
   * See https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Explicit_definition
   * @param {Number} t Interpolation variable in the range [0, 1].
   * @param {Number[][]} path The path to interpolate along.
   * @returns {Number[]} The interpolated point.
   */
  static interpolateFullBezier(t, path) {
    this._check(t, 1);
    const n = path.length - 1;

    const sum = new Array(path[0].length).fill(0);
    for (let i = 0; i <= n; i++) {
      const coeff =
        this.nChooseK(n, i) * Math.pow(t, i) * Math.pow(1 - t, n - i);
      for (let dim = 0; dim < sum.length; dim++)
        sum[dim] += coeff * path[i][dim];
    }

    return sum;
  }

  static get ENDPOINT_SAME() {
    return _Splines_ENDPOINT_SAME;
  }
  static get ENDPOINT_EXTRAPOLATE() {
    return _Splines_ENDPOINT_EXTRAPOLATE;
  }

  /**
   * Extrapolate one step from two given points.
   * @param {Number[]} point1
   * @param {Number[]} point2
   * @param {boolean} backwards
   */
  static extrapolate(point1, point2, backwards, steps = 1) {
    const res = new Array(point1.length).fill(0);
    for (let dim = 0; dim < res.length; dim++) {
      if (backwards)
        res[dim] = point1[dim] - steps * (point2[dim] - point1[dim]);
      else res[dim] = point2[dim] + steps * (point2[dim] - point1[dim]);
    }

    return res;
  }

  // /**
  //  * Interprets the n closest points as a Bezier curve and interpolates along
  //  * it.
  //  * With smooth=true it will do the same with an offset of 1 and interpolate
  //  * linearly between the results. This ensures that the interpolated path is
  //  * continuous.
  //  * @param {Number} t Interpolation variable in the range [0, 1].
  //  * @param {Number[][]} path The path to interpolate along.
  //  * @param {Number} n The number of points to consider for the curve.
  //  * @param {boolean} smooth Whether to ensure a continuous path.
  //  * @param {Number} bezierOffset Shift the selection of the n points by this.
  //  * @returns {Number[]} The interpolated point.
  //  */
  // // TODO : Currently not equivalent to old implementation (see below)
  // // Mainly, will not reach the endpoint and looks more crooked.
  // static interpolateLocalBezier(
  //   t,
  //   path,
  //   n,
  //   smooth = true,
  //   endpoints = this.ENDPOINT_SAME,
  //   bezierOffset = 0
  // ) {
  //   if (path.length === 1) return path[0];

  //   t *= path.length - 1;
  //   const bezierStart = Math.round(t - n / 2) + bezierOffset;

  //   //(t - Math.max(0, bezierStart)) / n;
  //   const interpol = (t - bezierStart) / (n - 1);
  //   const sum = new Array(path[0].length).fill(0);

  //   for (let i = 0; i <= n; i++) {
  //     let point;
  //     if (bezierStart + i >= 0 && bezierStart + i < path.length)
  //       point = path[bezierStart + i];
  //     else {
  //       // Endpoint handling
  //       switch (endpoints) {
  //         case this.ENDPOINT_EXTRAPOLATE:
  //           if (bezierStart + i < 0)
  //             point = this.extrapolate(
  //               path[0],
  //               path[1],
  //               true,
  //               -(bezierStart + i)
  //             );
  //           else
  //             point = this.extrapolate(
  //               path[path.length - 2],
  //               path[path.length - 1],
  //               false,
  //               bezierStart + i - (path.length - 1)
  //             );
  //           break;

  //         case this.ENDPOINT_SAME:
  //         default:
  //           point =
  //             path[Math.min(path.length - 1, Math.max(0, bezierStart + i))];
  //           break;
  //       }
  //     }

  //     // Compute sum
  //     const coeff =
  //       this.nChooseK(n, i) *
  //       Math.pow(interpol, i) *
  //       Math.pow(1 - interpol, n - i);
  //     for (let dim = 0; dim < sum.length; dim++) sum[dim] += coeff * point[dim];
  //   }

  //   if (smooth) {
  //     const otherSum = this.interpolateLocalBezier(
  //       t / (path.length - 1),
  //       path,
  //       n,
  //       false,
  //       endpoints,
  //       bezierOffset + 1
  //     );

  //     // Interpolate between the first -> second or second -> first
  //     // depending on n mod 2
  //     // if (n % 2 === 0)
  //     //     t += 0.5;
  //     // const metaInterpol = t - Math.floor(t);
  //     const fpart = t - Math.floor(t);
  //     const metaInterpol = (fpart > 0.5 ? 1 - fpart : fpart) / 0.5;

  //     for (let dim = 0; dim < sum.length; dim++)
  //       sum[dim] = metaInterpol * sum[dim] + (1 - metaInterpol) * otherSum[dim];
  //   }

  //   return sum;
  // }

  static get DERIVATIVE_MIDPOINT() {
    return _Splines_DERIVATIVE_MIDPOINT;
  }
  static get DERIVATIVE_BACKWARD() {
    return _Splines_DERIVATIVE_BACKWARD;
  }
  static get DERIVATIVE_FORWARD() {
    return _Splines_DERIVATIVE_FORWARD;
  }
  static get DERIVATIVE_OUT() {
    return _Splines_DERIVATIVE_OUT;
  }
  static get DERIVATIVE_ZERO() {
    return _Splines_DERIVATIVE_ZERO;
  }

  /**
   * Cubic Hermite interpolation along the provided path.
   * See https://en.wikipedia.org/wiki/Cubic_Hermite_spline#Interpolation_on_the_unit_interval_with_matched_derivatives_at_endpoints
   * @param {Number} t Interpolation variable in the range [0, 1].
   * @param {Number[][]} path The path to interpolate along.
   * @returns {Number[]} The interpolated point.
   */
  static interpolateHermite(
    t,
    path,
    derivativeMode = this.DERIVATIVE_MIDPOINT,
    endpoints = this.ENDPOINT_SAME
  ) {
    this._check(t, 1);
    t *= path.length - 1;

    const tFloor = Math.floor(t);
    const res = new Array(path[0].length).fill(0);
    if (tFloor === t) {
      for (let dim = 0; dim < res.length; dim++) res[dim] = path[tFloor][dim];
    } else {
      const p1 = path[tFloor];
      const p2 = path[tFloor + 1];
      let p0 = t > 1 ? path[tFloor - 1] : null;
      let p3 = t < path.length - 2 ? path[tFloor + 2] : null;

      switch (endpoints) {
        case this.ENDPOINT_EXTRAPOLATE:
          p0 = p0 || this.extrapolate(p1, p2, true);
          p3 = p3 || this.extrapolate(p1, p2, false);
          break;

        case this.ENDPOINT_SAME:
        default:
          p0 = p0 || p1;
          p3 = p3 || p2;
          break;
      }

      const p1_derivative = new Array(path[0].length).fill(0);
      const p2_derivative = new Array(path[0].length).fill(0);

      for (let dim = 0; dim < res.length; dim++) {
        switch (derivativeMode) {
          case this.DERIVATIVE_BACKWARD:
            p1_derivative[dim] = p1[dim] - p0[dim];
            p2_derivative[dim] = p2[dim] - p1[dim];
            break;

          case this.DERIVATIVE_FORWARD:
            p1_derivative[dim] = p2[dim] - p1[dim];
            p2_derivative[dim] = p3[dim] - p2[dim];
            break;

          case this.DERIVATIVE_OUT:
            p1_derivative[dim] = p1[dim] - p0[dim];
            p2_derivative[dim] = p3[dim] - p2[dim];
            break;

          case this.DERIVATIVE_ZERO:
            p1_derivative[dim] = 0;
            p2_derivative[dim] = 0;
            break;

          case this.DERIVATIVE_MIDPOINT:
          default:
            p1_derivative[dim] = (p2[dim] - p0[dim]) / 2;
            p2_derivative[dim] = (p3[dim] - p1[dim]) / 2;
            break;
        }
      }

      const interpol = t - tFloor;
      for (let dim = 0; dim < res.length; dim++)
        /*  x(t) = d + ct + bt^2 + at^3
                    d = p1
                    c = p1'
                    b = -3p1 + 3p2 - 2p1' - p2'
                    a = 2p1 - 2p2 + p1' + p2'   */
        res[dim] =
          p1[dim] +
          interpol *
            (p1_derivative[dim] +
              interpol *
                (3 * (p2[dim] - p1[dim]) -
                  2 * p1_derivative[dim] -
                  p2_derivative[dim] +
                  interpol *
                    (2 * (p1[dim] - p2[dim]) +
                      p1_derivative[dim] +
                      p2_derivative[dim])));
    }
    return res;
  }

  /**
   * Linear interpolation along the provided path. See https://en.wikipedia.org/wiki/Linear_interpolation.
   * @param {Number} t Interpolation variable in the range [0, 1].
   * @param {Number[][]} path The path to interpolate along.
   * @returns {Number[]} The interpolated point.
   */
  static interpolateLinear(t, path) {
    this._check(t, 1);
    t *= path.length - 1;

    const tFloor = Math.floor(t);
    const res = new Array(path[0].length).fill(0);
    if (tFloor === t) {
      for (let dim = 0; dim < res.length; dim++) res[dim] = path[tFloor][dim];
    } else {
      const interpol = t - Math.floor(t);
      for (let dim = 0; dim < res.length; dim++)
        res[dim] =
          path[tFloor][dim] * (1 - interpol) + path[tFloor + 1][dim] * interpol;
    }

    return res;
  }

  /**
   * Takes n + 1 evenly spaced samples in the [0, 1] range of the interpolation
   * function provided.
   * The result can be used with interpolateLinear to increase performance when
   * interpolating
   * complex shapes.
   * @param {Number} n
   * @param {Function} interpolationFunction
   * @returns {Number[][]}
   */
  static piecewise(n, interpolationFunction) {
    let res = new Array(n + 1).fill(null);
    for (let i = 0; i <= n; i++) res[i] = interpolationFunction(i / n);

    return res;
  }

  /**
   * Plots the path to a canvas.
   * @param {Number[][]} path The path to plot
   * @param {Number[][]} points Additional points to mark
   * @param {Number} scale Draw scale.
   */
  static _plot(path, points = null, scale = 100) {
    const xCoords = path.concat(points || []).map((point) => point[0]);
    const yCoords = path.concat(points || []).map((point) => point[1]);
    const xMin = Math.min(...xCoords);
    const xMax = Math.max(...xCoords);
    const yMin = Math.min(...yCoords);
    const yMax = Math.max(...yCoords);

    const canvas = document.createElement('canvas');
    canvas.width = scale * (2 + Math.ceil(xMax - xMin));
    canvas.height = scale * (2 + Math.ceil(yMax - yMin));
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = 'black';
    for (let x = 0; x < 1 + xMax - xMin; x++) {
      ctx.moveTo(scale * (x + 1), canvas.height - scale * 1);
      ctx.lineTo(
        scale * (x + 1),
        canvas.height - scale * (1 + Math.ceil(yMax - yMin))
      );
    }
    for (let y = 0; y < 1 + yMax - yMin; y++) {
      ctx.moveTo(scale * 1, canvas.height - scale * (y + 1));
      ctx.lineTo(
        scale * (1 + Math.ceil(xMax - xMin)),
        canvas.height - scale * (y + 1)
      );
    }
    ctx.stroke();

    const width = 4;
    const height = 4;
    const startCol = [255, 0, 0];
    const endCol = [0, 0, 255];

    if (points) {
      for (const point of points) {
        ctx.fillStyle = 'green';
        ctx.fillRect(
          scale * (point[0] - xMin + 1) - width,
          canvas.height - scale * (point[1] - yMin + 1) - height,
          width * 2,
          height * 2
        );
      }
    }

    let i = 0;
    for (const point of path) {
      const col = startCol.map(
        (v, j) =>
          v * (1 - i / (path.length - 1)) + (endCol[j] * i) / (path.length - 1)
      );
      ctx.fillStyle = `rgb(${col.join(',')})`;
      ctx.fillRect(
        scale * (point[0] - xMin + 1) - width / 2,
        canvas.height - scale * (point[1] - yMin + 1) - height / 2,
        width,
        height
      );
      i++;
    }
    document.body.appendChild(canvas);
  }

  static _debug() {
    let path = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 2],
      [1, 2],
      [2, 2],
      [2, 1],
      [2, 0],
    ];

    this._plot(
      this.piecewise(100, (t) => this.interpolateLinear(t, path)),
      path
    );

    this._plot(
      this.piecewise(100, (t) => this.interpolateHermite(t, path)),
      path
    );

    this._plot(
      this.piecewise(100, (t) => this.interpolateFullBezier(t, path)),
      path
    );

    let pieces = this.piecewise(12, (t) => this.interpolateFullBezier(t, path));
    this._plot(
      this.piecewise(100, (t) => this.interpolateLinear(t, pieces)),
      path
    );

    // this._plot(
    //   this.piecewise(100, (t) =>
    //     this.interpolateLocalBezier(t, path, 3, false, this.ENDPOINT_SAME, 0)
    //   ),
    //   path
    // );
    // this._plot(
    //   this.piecewise(100, (t) =>
    //     this.interpolateLocalBezier(t, path, 3, false, this.ENDPOINT_SAME, 1)
    //   ),
    //   path
    // );
    // this._plot(
    //   this.piecewise(100, (t) =>
    //     this.interpolateLocalBezier(t, path, 3, true, this.ENDPOINT_SAME)
    //   ),
    //   path
    // );
    // this._plot(
    //   this.piecewise(100, (t) =>
    //     this._originalInterpolateLocalBezier(t * path.length, path, 3, true)
    //   ),
    //   path
    // );

    // console.log(
    //   'Local Bezier equivalent to original',
    //   JSON.stringify(
    //     this.piecewise(100, (t) => this.interpolateLocalBezier(t, path, 3))
    //   ) ===
    //     JSON.stringify(
    //       this.piecewise(100, (t) =>
    //         this._originalInterpolateLocalBezier(
    //           t * path.length, path, 3, true)
    //       )
    //     )
    // );
  }

  static _originalInterpolateLocalBezier(t, path, n, smooth) {
    this._check(t, path.length);

    let newT = t - n / 2;
    let minInd = Math.max(0, Math.round(newT));

    let interpol = (t - minInd) / n;
    let sum = [0, 0];

    for (let i = 0; i <= n; i++) {
      let coeff =
        this.nChooseK(n, i) *
        Math.pow(interpol, i) *
        Math.pow(1 - interpol, n - i);
      sum[0] += coeff * path[Math.min(path.length - 1, minInd + i)][0];
      sum[1] += coeff * path[Math.min(path.length - 1, minInd + i)][1];
    }

    if (smooth && minInd > 0) {
      let otherSum = [0, 0];
      const offset = -1;
      let otherInterpol = Math.max(0, Math.min(n, t - minInd - offset) / n);

      for (let i = 0; i <= n; i++) {
        let coeff =
          this.nChooseK(n, i) *
          Math.pow(otherInterpol, i) *
          Math.pow(1 - otherInterpol, n - i);
        otherSum[0] +=
          coeff *
          path[Math.max(0, Math.min(path.length - 1, minInd + i + offset))][0];
        otherSum[1] +=
          coeff *
          path[Math.max(0, Math.min(path.length - 1, minInd + i + offset))][1];
      }

      t += 0.5 * (~n & 1);
      let metaInterpol = t - Math.trunc(t);

      sum[0] = metaInterpol * sum[0] + (1 - metaInterpol) * otherSum[0];
      sum[1] = metaInterpol * sum[1] + (1 - metaInterpol) * otherSum[1];
    }

    return sum;
  }
}
