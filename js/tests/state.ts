import {assertThat} from '../engine/assertions.js';
import {Suite} from '../engine/testing.js';
import {
  Lunchbox,
  TastyLunchbox,
  Entity,
  Var,
  registerEntity,
  createState,
} from '../state.js';

export class StateSuite extends Suite {
  testSerializeAndDeserialize() {
    const state = createState();

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
    console.log(createState(state.stringify()));

    const derived = state.fork();

    lunchbox.temperature.set(derived, 123);
    derived.destroy(microwave);
    console.log(derived.stringify());
    console.log(createState(derived.stringify()));
  }
}
