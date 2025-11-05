interface WaitInstruction {
  keyword: 'wait';
  delay: number;
}

interface SpawnInstruction<
  T extends abstract new (...args: unknown[]) => unknown
> {
  keyword: 'spawn';
  type: T;
  args?: ConstructorParameters<T> | (() => ConstructorParameters<T>);
}

interface CallInstruction<T extends (...args: unknown[]) => void> {
  keyword: 'call';
  func: T;
  args?: Parameters<T> | (() => Parameters<T>);
}

type Instruction =
  | WaitInstruction
  | SpawnInstruction<never>
  | CallInstruction<never>;

interface BuilderCommon {
  /**
   * Sekvensens längd till slutet, i enheter av rum/tids-avstånd.
   */
  get length(): number;
  /**
   * Köa ett visst antal objekt. Följs av immediately(), over() eller spaced().
   * @param type Objektens typ.
   * @param number Antalet objekt som ska köas.
   * @param args Argument till konstruktorn.
   */
  spawn(type: new () => unknown): UncommittedBuilder;
  spawn(type: new () => unknown, number: number): UncommittedBuilder;
  spawn<T extends abstract new (...args: unknown[]) => unknown>(
    type: T,
    number: number,
    args: ConstructorParameters<T> | (() => ConstructorParameters<T>)
  ): UncommittedBuilder;
  /**
   * Ange eller köa funktionsanrop.
   * @param func Funktionen som ska anropas.
   * @param times Antal upprepningar (default 1).
   * @param args Argument till funktionen.
   */
  call(func: () => void): UncommittedBuilder;
  call(func: () => void, times: number): UncommittedBuilder;
  call<T extends (...args: unknown[]) => void>(
    func: T,
    times: number,
    args: Parameters<T> | (() => Parameters<T>)
  ): UncommittedBuilder;
}

/**
 * Builder med objekt eller anrop som ännu inte placerats ut i på
 * rum/tids-axeln.
 */
interface UncommittedBuilder extends BuilderCommon {
  /**
   * Ange att de köade objekten ska skickas allihopa på en gång.
   */
  immediately(): CommittedBuilder;
  /**
   * Ange att de köade objekten ska skickas jämnt fördelat på ett intervall.
   * @param interval Längden på intervallet i enheter av rum/tids-avstånd.
   * @param integerize Om avstånden mellan två objekt alltid ska vara heltal
   *     (default false).
   */
  over(interval: number): CommittedBuilder;
  over(interval: number, integerize: boolean): CommittedBuilder;
  /**
   * Ange att de köade objekten ska skickas med ett konstant avstånd
   * sinsemellan.
   * @param {Number} interval Längden på intervallet mellan två objekt i
   * 		enheter av rum/tids-avstånd
   */
  spaced(interval: number): CommittedBuilder;
}

interface CommittedBuilder extends BuilderCommon {
  /**
   * Ange en paus i sekvensen utan att något spawnas.
   * @param delay Pausens längd i enheter av rum/tids-avstånd
   */
  wait(delay: number): CommittedBuilder;
  /**
   * Sammanfläta den här sekvensen med en annan sekvens.
   * @param other Sekvensen som ska vävas ihop med denna.
   */
  interleave(other: Sequence | CommittedBuilder): CommittedBuilder;
  /**
   * Lägg till en annan sekvens efter denna.
   * @param other Sekvensen som ska följa denna.
   */
  append(other: Sequence | CommittedBuilder): CommittedBuilder;
  /** Sätt punkt för sekvensen och skapa en Sequence som kan itereras. */
  build(): Sequence;
}

function cloneInstruction(instruction: Instruction): Instruction {
  if (instruction.keyword === 'wait') {
    return {keyword: 'wait', delay: instruction.delay};
  }
  // Övriga instruktioner bör betraktas som immutable
  return instruction;
}

class SequenceBuilder implements UncommittedBuilder, CommittedBuilder {
  private committedSequence: Instruction[] = [];
  private uncommittedSequence: Instruction[] = [];

  get length() {
    return this.committedSequence
      .concat(this.uncommittedSequence)
      .reduce(
        (total: number, instruction: Instruction) =>
          instruction.keyword === 'wait' ? total + instruction.delay : total,
        0
      );
  }

  wait(delay: number): CommittedBuilder {
    if (!(delay >= 0)) {
      throw new Error('Invalid delay ' + delay);
    }
    this.committedSequence.push({keyword: 'wait', delay});
    return this;
  }

  spawn<T extends abstract new (...args: unknown[]) => unknown>(
    type: T,
    number: number = 1,
    args?: ConstructorParameters<T> | (() => ConstructorParameters<T>)
  ): UncommittedBuilder {
    if (!(number > 0)) {
      throw new Error('Invalid number ' + number);
    }

    const instruction = {keyword: 'spawn', type, args};
    this.uncommittedSequence = this.uncommittedSequence.concat(
      new Array(number).fill(instruction)
    );

    return this;
  }

  call<T extends (...args: unknown[]) => void>(
    func: T,
    times: number = 1,
    args?: Parameters<T> | (() => Parameters<T>)
  ): UncommittedBuilder {
    if (!(times > 0)) {
      throw new Error('Invalid times ' + times);
    }

    const instruction = {keyword: 'call', func, args};
    this.uncommittedSequence = this.uncommittedSequence.concat(
      new Array(times).fill(instruction)
    );
    return this;
  }

  immediately(): CommittedBuilder {
    this.committedSequence = this.committedSequence.concat(
      this.uncommittedSequence
    );
    return this;
  }

  over(interval: number, integerize: boolean = false): CommittedBuilder {
    if (!(interval >= 0)) {
      throw new Error('Invalid interval ' + interval);
    }

    const nDelays = this.uncommittedSequence.length - 1;
    let delays = new Array(nDelays);
    if (integerize) {
      delays = delays
        .fill(0)
        .map(
          (_, i) =>
            Math.floor((interval * (i + 1)) / nDelays) -
            Math.floor((interval * i) / nDelays)
        );
    } else {
      delays = delays.fill(interval / nDelays);
    }

    for (let i = 0; i < this.uncommittedSequence.length; i++) {
      if (i !== 0) {
        this.committedSequence.push({keyword: 'wait', delay: delays[i - 1]});
      }
      this.committedSequence.push(this.uncommittedSequence[i]);
    }
    this.uncommittedSequence = [];

    return this;
  }

  spaced(interval: number): CommittedBuilder {
    if (!(interval >= 0)) throw new Error('Invalid interval ' + interval);

    for (let i = 0; i < this.uncommittedSequence.length; i++) {
      if (i !== 0) {
        this.committedSequence.push({keyword: 'wait', delay: interval});
      }
      this.committedSequence.push(this.uncommittedSequence[i]);
    }
    this.uncommittedSequence = [];

    return this;
  }

  interleave(other: Sequence | CommittedBuilder): CommittedBuilder {
    // Make a copy to avoid editing the other sequence.
    const otherSequence = (
      other instanceof Sequence
        ? other.instructions
        : (other as SequenceBuilder).committedSequence
    ).map(cloneInstruction);
    let thisIndex = 0;
    let otherIndex = 0;

    while (
      thisIndex < this.committedSequence.length &&
      otherIndex < otherSequence.length
    ) {
      const t = this.committedSequence[thisIndex];
      const o = otherSequence[otherIndex];
      if (t.keyword === 'wait' && o.keyword === 'wait') {
        if (t.delay === o.delay) {
          this.uncommittedSequence.push(t);
          thisIndex++;
          otherIndex++;
        } else {
          this.uncommittedSequence.push({
            keyword: 'wait',
            delay: Math.min(t.delay, o.delay),
          });
          if (t.delay > o.delay) {
            t.delay = t.delay - o.delay;
            otherIndex++;
          } else {
            o.delay = o.delay - t.delay;
            thisIndex++;
          }
        }
      } else {
        if (t.keyword !== 'wait') {
          this.uncommittedSequence.push(t);
          thisIndex++;
        }
        if (o.keyword !== 'wait') {
          this.uncommittedSequence.push(o);
          otherIndex++;
        }
      }
    }
    if (thisIndex !== this.committedSequence.length)
      this.uncommittedSequence = this.uncommittedSequence.concat(
        this.committedSequence.slice(thisIndex)
      );
    if (otherIndex !== otherSequence.length)
      this.uncommittedSequence = this.uncommittedSequence.concat(
        otherSequence.slice(otherIndex)
      );

    this.committedSequence = this.uncommittedSequence;
    this.uncommittedSequence = [];

    return this;
  }

  append(other: Sequence | CommittedBuilder) {
    // Make a copy to avoid editing the other sequence.
    const otherSequence = (
      other instanceof Sequence
        ? other.instructions
        : (other as SequenceBuilder).committedSequence
    ).map(cloneInstruction);
    this.committedSequence = this.committedSequence.concat(otherSequence);
    return this;
  }

  build(): Sequence {
    return new Sequence(this.committedSequence);
  }
}

/**
 * Basklass för att skapa (spawna) sekvenser av GameObjects.
 */
export class Sequence {
  private _elapsed: number = 0;

  constructor(
    readonly instructions: readonly Instruction[],
    private index: number = 0,
    elapsed: number = 0
  ) {
    this._elapsed = elapsed;
  }

  /**
   * Sekvensens (kvarvarande, om den börjat iterera) längd till slutet, i
   * enheter av rum/tids-avstånd.
   */
  get length() {
    return this.instructions.reduce(
      (total: number, instruction: Instruction) =>
        instruction.keyword === 'wait' ? total + instruction.delay : total,
      0
    );
  }

  get elapsed() {
    return this._elapsed;
  }

  private isSignificantWait(instruction: Instruction) {
    return instruction.keyword === 'wait' && instruction.delay > 0;
  }

  /**
   * Spawna ett nytt objekt av en viss typ. Kör konstruktorn utan några
   * argument.
   */
  private doSpawn(instruction: SpawnInstruction<never>) {
    const args: unknown[] | undefined =
      instruction.args instanceof Function
        ? (instruction.args() as unknown[])
        : instruction.args;
    if (args) {
      return new (instruction.type as new (...args: unknown[]) => unknown)(
        ...args
      );
    }
    return new (instruction.type as new () => unknown)();
  }

  /**
   * Anropa en funktion utan några argument.
   */
  private doCall(instruction: CallInstruction<never>) {
    const args: unknown[] | undefined =
      instruction.args instanceof Function
        ? (instruction.args() as unknown[])
        : instruction.args;
    if (args) {
      return (instruction.func as (...args: unknown[]) => unknown)(...args);
    }
    return (instruction.func as () => unknown)();
  }

  /**
   * Hantera andra instruktioner än "wait", "call" och "spawn" i next().
   */
  protected nonstandardInstruction<T extends {keyword: string}>(
    instruction: T
  ) {
    throw new Error(`Unknown instruction: ${instruction.keyword}`);
  }

  /**
   * Stega framåt i itereringen och utför de operationer som köats.
   * @param {Number} delta Steglängd i enheter av rum/tids-avstånd
   */
  next(delta: number = 1): {done: boolean; remainingDelta?: number} {
    let remainingDelta: number | null = delta;
    while (remainingDelta !== null) {
      // Gå igenom alla instruktioner tills vi måste vänta
      while (
        this.index < this.instructions.length &&
        !this.isSignificantWait(this.instructions[this.index])
      ) {
        const instruction = this.instructions[this.index];
        switch (instruction.keyword) {
          case 'call':
            this.doCall(instruction);
            break;

          case 'spawn':
            this.doSpawn(instruction);
            break;

          case 'wait':
            break;

          default:
            // Om man ärver från denna klass kan man hantera
            // specialinstruktioner genom att overrida nonstandardInstruction()
            this.nonstandardInstruction(instruction);
            break;
        }

        this.index++;
      }
      if (this.index < this.instructions.length) {
        // this.index pekar på en wait med mer än 0 kvar
        const instruction = this.instructions[this.index] as WaitInstruction;
        instruction.delay -= remainingDelta;

        if (instruction.delay <= 0) {
          this._elapsed += remainingDelta + instruction.delay;
          remainingDelta = -instruction.delay;
          instruction.delay = 0;
          this.index++;
        } else {
          this._elapsed += remainingDelta;
          remainingDelta = null;
        }
      } else {
        return {done: true, remainingDelta};
      }
    }

    return {done: false};
  }

  /**
   * Klona den här sekvensen.
   *
   * Ej tillåtet under iterering eftersom wait-instruktioner då har hunnit
   * modifieras.
   */
  clone() {
    if (this._elapsed > 0)
      throw new Error('Cannot clone sequence after iteration has begun');
    return new Sequence(this.instructions.map(cloneInstruction));
  }
}

export function defineSequence(): CommittedBuilder {
  return new SequenceBuilder();
}

// Dessa kändes inte supernödvändiga så plockade bort dem
// /**
//  * Sekvens med extra felsökningsmöjligheter
//  */
// export class DebuggableSequence extends Sequence {
//   constructor() {
//     super();
//     this._sent = {};
//   }

//   // Felsökningsfunktioner
//   /**
//    * Ett objekt som bekriver vilka objekt som skapats hittills
//    */
//   get sent() {
//     return this._sent;
//   }

//   /**
//    * Ett objekt som beskriver hur många objekt som skapas i sekvensen
//    */
//   get summary() {
//     if (!this.iterating || !this._summary)
//       this._summary = this.totalSequence
//         .concat(this.currentSequence)
//         .reduce((tot, ins) => {
//           if (ins[0] === 'spawn')
//             tot[ins[1].name] = (tot[ins[1].name] || 0) + 1;

//           return tot;
//         }, {});

//     return this._summary;
//   }

//   /**
//    * Ett objekt som beskriver hur många objekt som är kvar att skicka
//    */
//   get remaining() {
//     let smry = this.summary;
//     if (!this.iterating) return smry;
//     let sent = this.sent;
//     let rem = {};

//     for (let t in smry) rem[t] = smry[t] - (sent[t] || 0);

//     return rem;
//   }

//   /**
//    * Ett objekt som mappar klassnamn till dess typ, för alla objekt som
//    * kommer spawnas av denna sekvens.
//    */
//   get codebook() {
//     return this.totalSequence
//       .concat(this.currentSequence)
//       .reduce((tot, ins) => {
//         if (ins[0] === 'spawn' && !tot[ins[1].name]) {
//           tot[ins[1].name] = ins[1];
//         }

//         return tot;
//       }, {});
//   }

//   /**
//    * Köa ett visst antal objekt. Följs av immediately(), over() eller
//    * spaced().
//    * @param {*} type Objektens typ.
//    * @param {Number} number Antalet objekt som ska köas.
//    */
//   spawn(type, number = 1) {
//     this._summary = null;
//     return super.spawn(type, number);
//   }

//   /**
//    * Spawna ett nytt objekt av en viss typ. Kör konstruktorn utan några
//    * argument.
//    * @param {["spawn", *]} instruction En array med "spawn" först, följt av
//    * 		typen som ska skapas.
//    */
//   doSpawn(instruction) {
//     this._sent[instruction[1].name] =
//       (this._sent[instruction[1].name] || 0) + 1;
//     return super.spawn(instruction);
//   }
// }
