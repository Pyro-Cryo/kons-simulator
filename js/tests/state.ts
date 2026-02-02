import {assertThat} from '../engine/assertions.js';
import {Suite} from '../engine/testing.js';
import {
  State,
  Lunchbox,
  TastyLunchbox,
  Entity,
  Var,
  registerEntity,
} from '../state.js';

export class StateSuite extends Suite {
  testSerializeAndDeserialize() {
    const state = new State();

    const lunchbox = state.create(Lunchbox);
    const lunchbox2 = state.create(Lunchbox);

    const lunchbox3 = state.create(TastyLunchbox);

    class Microwave extends Entity {
      private model = new Var('Electrolux');
      private power = new Var(1000);
    }
    registerEntity(Microwave);

    const microwave = state.create(Microwave);
    state.destroy(lunchbox2);
    lunchbox3.heat(state);

    console.log(state.stringify());
    console.log(State.parse(state.stringify()));

    const derived = state.fork();

    lunchbox.temperature.set(derived, 123);
    derived.destroy(microwave);
    console.log(derived.stringify());
    console.log(State.parse(derived.stringify()));
  }
}
