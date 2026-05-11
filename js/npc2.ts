import {Entity} from './state/entity.js';
import {Position, Positionable} from './state/interfaces.js';
import {variable} from './state/variableImpl.js';

export class Person extends Entity implements Positionable {
  readonly hunger = variable(0);
  readonly studying = variable(0);
  readonly fun = variable(0);

  readonly position = variable<Position>(null);
}
