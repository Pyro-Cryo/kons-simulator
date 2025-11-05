enum Endpoint {
  SAME,
  EXTRAPOLATE,
}

enum Derivative {
  MIDPOINT,
  BACKWARD,
  FORWARD,
  OUT,
  ZERO,
}

function check(t: number, upperBound: number) {
  if (!(t >= 0 && t <= upperBound))
    throw new Error('t out of bounds [0, ' + upperBound + '] with value ' + t);
}

export class SplinesImpl {
  private pascalTriangle: number[][] = [[1], [1, 1]];
  nChooseK(n: number, k: number) {
    while (this.pascalTriangle.length <= n) {
      const currentN = this.pascalTriangle.length;
      const row = new Array(currentN + 1).fill(1);
      for (let i = 1; i < currentN; i++)
        row[i] =
          this.pascalTriangle[currentN - 1][i - 1] +
          this.pascalTriangle[currentN - 1][i];

      this.pascalTriangle.push(row);
    }

    return this.pascalTriangle[n][k];
  }

  /**
   * Interprets the path as a degree {path.length - 1} Bezier curve and
   * interpolates along it.
   * See https://en.wikipedia.org/wiki/B%C3%A9zier_curve#Explicit_definition
   * @param t Interpolation variable in the range [0, 1].
   * @param path The path to interpolate along.
   * @returns The interpolated point.
   */
  interpolateFullBezier(t: number, path: number[][]): number[] {
    check(t, 1);
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

  /**
   * Extrapolate one step from two given points.
   */
  extrapolate(
    point1: number[],
    point2: number[],
    backwards: boolean,
    steps: number = 1
  ) {
    const res = new Array(point1.length).fill(0);
    for (let dim = 0; dim < res.length; dim++) {
      if (backwards)
        res[dim] = point1[dim] - steps * (point2[dim] - point1[dim]);
      else res[dim] = point2[dim] + steps * (point2[dim] - point1[dim]);
    }

    return res;
  }

  /**
   * Cubic Hermite interpolation along the provided path.
   * See https://en.wikipedia.org/wiki/Cubic_Hermite_spline#Interpolation_on_the_unit_interval_with_matched_derivatives_at_endpoints
   * @param t Interpolation variable in the range [0, 1].
   * @param path The path to interpolate along.
   * @returns The interpolated point.
   */
  interpolateHermite(
    t: number,
    path: number[][],
    derivativeMode: Derivative = Derivative.MIDPOINT,
    endpoints: Endpoint = Endpoint.SAME
  ): number[] {
    check(t, 1);
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
        case Endpoint.EXTRAPOLATE:
          p0 = p0 || this.extrapolate(p1, p2, true);
          p3 = p3 || this.extrapolate(p1, p2, false);
          break;

        case Endpoint.SAME:
        default:
          p0 = p0 || p1;
          p3 = p3 || p2;
          break;
      }

      const p1_derivative = new Array(path[0].length).fill(0);
      const p2_derivative = new Array(path[0].length).fill(0);

      for (let dim = 0; dim < res.length; dim++) {
        switch (derivativeMode) {
          case Derivative.BACKWARD:
            p1_derivative[dim] = p1[dim] - p0[dim];
            p2_derivative[dim] = p2[dim] - p1[dim];
            break;

          case Derivative.FORWARD:
            p1_derivative[dim] = p2[dim] - p1[dim];
            p2_derivative[dim] = p3[dim] - p2[dim];
            break;

          case Derivative.OUT:
            p1_derivative[dim] = p1[dim] - p0[dim];
            p2_derivative[dim] = p3[dim] - p2[dim];
            break;

          case Derivative.ZERO:
            p1_derivative[dim] = 0;
            p2_derivative[dim] = 0;
            break;

          case Derivative.MIDPOINT:
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
   * @param t Interpolation variable in the range [0, 1].
   * @param path The path to interpolate along.
   * @returns The interpolated point.
   */
  interpolateLinear(t: number, path: number[][]): number[] {
    check(t, 1);
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
   * function provided. The result can be used with interpolateLinear to
   * increase performance when interpolating complex shapes.
   */
  piecewise(
    n: number,
    interpolationFunction: (t: number) => number[]
  ): number[][] {
    const res = new Array(n + 1).fill(null);
    for (let i = 0; i <= n; i++) {
      res[i] = interpolationFunction(i / n);
    }

    return res;
  }

  /**
   * Plots the path to a canvas.
   * @param path The path to plot
   * @param points Additional points to mark
   * @param scale Draw scale.
   */
  private plot(path: number[][], points?: number[][], scale: number = 100) {
    const xCoords = path.concat(points ?? []).map((point) => point[0]);
    const yCoords = path.concat(points ?? []).map((point) => point[1]);
    const xMin = Math.min(...xCoords);
    const xMax = Math.max(...xCoords);
    const yMin = Math.min(...yCoords);
    const yMax = Math.max(...yCoords);

    const canvas = document.createElement('canvas');
    canvas.width = scale * (2 + Math.ceil(xMax - xMin));
    canvas.height = scale * (2 + Math.ceil(yMax - yMin));
    const ctx = canvas.getContext('2d')!;
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

  private debug() {
    const path = [
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

    this.plot(
      this.piecewise(100, (t: number) => this.interpolateLinear(t, path)),
      path
    );

    this.plot(
      this.piecewise(100, (t: number) => this.interpolateHermite(t, path)),
      path
    );

    this.plot(
      this.piecewise(100, (t: number) => this.interpolateFullBezier(t, path)),
      path
    );

    const pieces = this.piecewise(12, (t: number) =>
      this.interpolateFullBezier(t, path)
    );
    this.plot(
      this.piecewise(100, (t: number) => this.interpolateLinear(t, pieces)),
      path
    );
  }
}

export const Splines = new SplinesImpl();
