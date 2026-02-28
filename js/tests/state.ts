import {assertThat} from '../engine/assertions.js';
import {Suite} from '../engine/testing.js';
import {
  Lunchbox,
  TastyLunchbox,
  Entity,
  variable,
  registerEntity,
  createState,
  setVariable,
} from '../state.js';

export class StateSuite extends Suite {
  testSerializeAndDeserialize() {
    const state = createState();

    const lunchbox = state.create(Lunchbox);
    const lunchbox2 = state.create(Lunchbox);

    const lunchbox3 = state.create(TastyLunchbox);

    class Microwave extends Entity {
      private model = variable('Electrolux');
      private power = variable(1000);
      buttonLabels = setVariable<string>();
      containedLunchbox = variable<Lunchbox | null>(null);
    }
    registerEntity(Microwave);

    const microwave = state.create(Microwave);
    microwave.buttonLabels.add(state, 'start');
    microwave.buttonLabels.add(state, 'stop');
    microwave.containedLunchbox.set(state, lunchbox);
    lunchbox2.heat(state);
    state.destroy(lunchbox2);
    lunchbox3.heat(state);

    console.log(state);
    console.log(state.stringify());
    console.log(createState(state.stringify()));

    const derived = state.fork();

    lunchbox.temperature.set(derived, 123);
    microwave.buttonLabels.add(derived, 'pause');
    microwave.buttonLabels.delete(derived, 'stop');
    assertThat(microwave.buttonLabels.get(derived)).setEquals([
      'start',
      'pause',
    ]);
    // derived.destroy(microwave);
    console.log(derived.stringify());
    console.log(createState(derived.stringify()));
  }
}
