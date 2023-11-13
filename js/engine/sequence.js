"use strict";

/**
 * Basklass för att skapa (spawna) sekvenser av GameObjects.
 */
class BaseSequence  {
	constructor() {
		this.iterating = false;
		this.currentSequence = [];
		this.totalSequence = [];
	}

	/**
	 * Kolla att objektet är redo för att modifieras.
	 * @param {boolean} requireNothingQueued Kräv att inget är köat med send().
	 */
	_checks(requireNothingQueued) {
		if (requireNothingQueued !== undefined && requireNothingQueued ^ (this.currentSequence.length === 0)) {
			console.log(this);
			throw new Error("Invalid state for this operation");
		}
		if (this.iterating)
			throw new Error("Cannot modify sequence once iteration has begun");
	}

	/**
	 * Sekvensens (kvarvarande, om den börjat iterera) längd till slutet, i enheter av rum/tids-avstånd
	 */
	get length() {
		return this.totalSequence.concat(this.currentSequence).reduce((tot, ins) => ins[0] === "wait" ? tot + ins[1] : tot, 0);
	}

	// Byggarfunktioner
	/**
	 * Ange en paus i sekvensen utan att något spawnas.
	 * @param {Number} delay Pausens längd i enheter av rum/tids-avstånd
	 */
	wait(delay) {
		this._checks(true);
		if (!(delay >= 0))
			throw new Error("Invalid delay " + delay);

		this.totalSequence.push(["wait", delay]);

		return this;
	}

	/**
	 * Köa ett visst antal objekt. Följs av immediately(), over() eller spaced().
	 * @param {*} type Objektens typ.
	 * @param {Number} number Antalet objekt som ska köas.
	 */
	spawn(type, number = 1) {
		this._checks();
		if (number < 0)
			throw new Error("Invalid number " + number);
		this.currentSequence = this.currentSequence.concat(new Array(number).fill(["spawn", type]));

		return this;
	}

	/**
	 * Ange att de köade objekten ska skickas allihopa på en gång.
	 */
	immediately() {
		this._checks(false);

		this.totalSequence = this.totalSequence.concat(this.currentSequence);
		this.currentSequence = [];

		return this;
	}

	/**
	 * Ange att de köade objekten ska skickas jämnt fördelat på ett intervall.
	 * @param {Number} interval Längden på intervallet i enheter av rum/tids-avstånd
	 * @param {boolean} integerize Om avstånden mellan två objekt alltid ska vara heltal.
	 */
	over(interval, integerize = false) {
		this._checks(false);
		if (!(interval >= 0))
			throw new Error("Invalid interval " + interval);

		const nDelays = this.currentSequence.length - 1;
		let delays = new Array(nDelays);
		if (integerize) {
			delays = delays.fill(0).map(
				(_, i) => Math.floor(interval * (i + 1) / nDelays)
					- Math.floor(interval * i / nDelays)
			);
		} else
			delays = delays.fill(interval / nDelays);
		
		for (let i = 0; i < this.currentSequence.length; i++) {
			if (i !== 0)
				this.totalSequence.push(["wait", delays[i - 1]]);
			this.totalSequence.push(this.currentSequence[i]);
		}
		this.currentSequence = [];

		return this;
	}

	/**
	 * Ange att de köade objekten ska skickas med ett konstant avstånd sinsemellan.
	 * @param {Number} interval Längden på intervallet mellan två objekt i enheter av rum/tids-avstånd
	 */
	spaced(interval) {
		this._checks(false);
		if (!(interval >= 0))
			throw new Error("Invalid interval " + interval);

		for (let i = 0; i < this.currentSequence.length; i++) {
			if (i !== 0)
				this.totalSequence.push(["wait", interval]);
			this.totalSequence.push(this.currentSequence[i]);
		}
		this.currentSequence = [];

		return this;
	}

	/**
	 * Ange eller köa funktionsanrop.
	 * @param {Function} func Funktionen som ska anropas.
	 * @param {Number} times Antal upprepningar. Om denna sätts till 0 (default) anger det funktionsanropet direkt (motsvarar ungefär call(func, 1).immediately()).
	 */
	call(func, times = 0) {
		if (!(times >= 0))
			throw new Error("Invalid times " + times);
		else if (times === 0) {
			this._checks(true);
			this.totalSequence.push(["call", func]);
		} else {
			this._checks();
			this.currentSequence = this.currentSequence.concat(new Array(times).fill(["call", func]));
		}

		return this;
	}

	// Kombineringsfunktioner
	/**
	 * Sammanfläta den här sekvensen med en annan sekvens.
	 * @param {BaseSequence} other Sekvensen som ska vävas ihop med denna.
	 */
	interleave(other) {
		this._checks(true);
		other._checks(true);

		let this_ind = 0;
		let other_ind = 0;

		while (this_ind < this.totalSequence.length && other_ind < other.totalSequence.length) {
			let t = this.totalSequence[this_ind];
			let o = other.totalSequence[other_ind];
			if (t[0] === "wait" && o[0] === "wait") {
				if (t[1] === o[1]) {
					this.currentSequence.push(t);
					this_ind++;
					other_ind++;
				}
				else {
					this.currentSequence.push(["wait", Math.min(t[1], o[1])]);
					if (t[1] > o[1]) {
						t[1] = t[1] - o[1];
						other_ind++;
					} else {
						o[1] = o[1] - t[1];
						this_ind++;
					}
				}
			} else {
				if (t[0] !== "wait") {
					this.currentSequence.push(t);
					this_ind++;
				}
				if (o[0] !== "wait") {
					this.currentSequence.push(o);
					other_ind++;
				}
			}
		}
		if (this_ind !== this.totalSequence.length)
			this.currentSequence = this.currentSequence.concat(this.totalSequence.slice(this_ind));
		if (other_ind !== other.totalSequence.length)
			this.currentSequence = this.currentSequence.concat(other.totalSequence.slice(other_ind));

		this.totalSequence = this.currentSequence;
		this.currentSequence = [];
		other.totalSequence = [];

		return this;
	}

	/**
	 * Lägg till en annan sekvens efter denna.
	 * @param {BaseSequence} sequence Sekvensen som ska följa denna.
	 */
	append(sequence) {
		this._checks();
		sequence._checks();

		this.totalSequence = this.totalSequence.concat(sequence.totalSequence);
		return this;
	}

	// Itereringsfunktioner
	/**
	 * Spawna ett nytt objekt av en viss typ. Kör konstruktorn utan några argument.
	 * @param {["spawn", *]} instruction En array med "spawn" först, följt av typen som ska skapas.
	 */
	doSpawn(instruction) {
		return new instruction[1]();
	}

	/**
	 * Anropa en funktion utan några argument
	 * @param {["call", *]} instruction En array med "call" först, följt av funktionen som ska anropas.
	 */
	doCall(instruction) {
		return instruction[1]();
	}

	/**
	 * Hantera andra instruktioner än "wait", "call" och "spawn" i next().
	 * @param {[string, ...*]} instruction En array med instruktionstypen först, följt av eventuella argument.
	 */
	nonstandardInstruction(instruction) {
		throw new Error(`Unknown instruction: ${instruction[0]}`);
	}
	
	/**
	 * Stega framåt i itereringen och utför de operationer som köats.
	 * @param {Number} delta Steglängd i enheter av rum/tids-avstånd
	 */
	next(delta = 1) {
		// Börja iterera första gången next() anropas, och förhindra att sekvensen ändras.
		if (!this.iterating) {
			this.iterating = true;
			this.index = 0;
			this.elapsed = 0;
		}
		while (delta !== null) {
			// Gå igenom alla instruktioner tills vi måste vänta
			while (this.index < this.totalSequence.length && (this.totalSequence[this.index][0] !== "wait" || this.totalSequence[this.index][1] === 0)) {
				let instruction = this.totalSequence[this.index];
				switch (instruction[0]) {
					case "call":
						this.doCall(instruction);
						break;

					case "spawn":
						this.doSpawn(instruction);
						break;
					
					case "wait":
						break;
					
					default:
						// Om man ärver från denna klass kan man hantera specialinstruktioner
						// genom att overrida nonstandardInstruction()
						this.nonstandardInstruction(instruction);
						break;
				}

				this.index++;
			}
			if (this.index < this.totalSequence.length) {
				// this.index pekar på en wait med mer än 0 kvar
				this.totalSequence[this.index][1] -= delta;

				if (this.totalSequence[this.index][1] <= 0) {
					this.elapsed += delta + this.totalSequence[this.index][1];
					delta = -this.totalSequence[this.index][1];
					this.totalSequence[this.index][1] = 0;
					this.index++;
				} else {
					this.elapsed += delta;
					delta = null;
				}
			} else
				return { done: true, remainingDelta: delta };
		}

		return { done: false };
	}

	/**
	 * Klona den här sekvensen.
	 * 
	 * Ej tillåtet under iterering eftersom wait-instruktioner då har hunnit modifieras.
	 */
	clone() {
		if (this.iterating)
			throw new Error("Cannot clone sequence after iteration has begun");
		const sequence = new this.constructor();
		sequence.currentSequence = this.currentSequence.map(this.cloneInstruction);
		sequence.totalSequence = this.totalSequence.map(this.cloneInstruction);

		return sequence;
	}

	/**
	 * Klona en viss instruktion.
	 * @param {[string, ...*]} instruction 
	 */
	cloneInstruction(instruction) {
		if (instruction[0] === "wait")
			return ["wait", instruction[1]];
		else
			// Övriga instruktioner bör betraktas som immutable
			return instruction;
	}
}

class ArgableSequence extends BaseSequence {
	/**
	 * Köa ett visst antal objekt, med argument till konstruktorn. Följs av immediately(), over() eller spaced().
	 * 
	 * Argumenten kan vara antingen en array som populerar parametrarna till konstruktorn, eller en funktion som anropas vid spawnandet och då returnerar en sådan array.
	 * @param {*} type Objektens typ.
	 * @param {Number} number Antalet objekt som ska köas.
	 * @param {Function | Array} args Argumenten till konstruktorn för typen, eller en funktion som returnerar dessa.
	 */
	spawn(type, number = 1, args = null) {
		this._checks();
		if (number < 0)
			throw new Error("Invalid number " + number);
		const instruction = args === null ? ["spawn", type] : ["spawn", type, args];
		this.currentSequence = this.currentSequence.concat(new Array(number).fill(instruction));

		return this;
	}

	/**
	 * Spawna ett nytt objekt av en viss typ, med de angivna argumenten.
	 * @param {["spawn", *] | ["spawn", *, Array | Function]} instruction En array med "spawn" först, följt av typen som ska skapas, följt av eventuella argument.
	 */
	doSpawn(instruction) {
		if (instruction.length > 2 && instruction[2] !== null) {
			let args = instruction[2];
			if (args instanceof Function)
				args = args(this.elapsed);
			return new instruction[1](...args);
		} else
			return new instruction[1]();
	}

	/**
	 * Ange eller köa funktionsanrop.
	 * @param {Function} func Funktionen som ska anropas.
	 * @param {Number} times Antal upprepningar. Om denna sätts till 0 (default) anger det funktionsanropet direkt (motsvarar ungefär call(func, 1).immediately()).
	 * @param {Function | Array} args Argumenten till funktionen, eller en funktion som i sig returnerar dessa.
	 */
	call(func, times = 0, args = null) {
		const instruction = args === null ? ["call", func] : ["call", func, args];
		if (times < 0)
			throw new Error("Invalid times " + times);
		else if (times === 0) {
			this._checks(true);
			this.totalSequence.push(instruction);
		} else {
			this._checks();
			this.currentSequence = this.currentSequence.concat(new Array(times).fill(instruction));
		}

		return this;
	}

	/**
	 * Anropa en funktion
	 * @param {["call", *] | ["call", *, Array | Function]} instruction En array med "call" först, följt av funktionen som ska anropas, följt av eventuella argument.
	 */
	doCall(instruction) {
		if (instruction.length > 2 && instruction[2] !== null) {
			let args = instruction[2];
			if (args instanceof Function)
				args = args(this.elapsed);
			return instruction[1](...args);
		}
		else
			return instruction[1]();
	}
}

// Dessa kändes inte supernödvändiga så plockade bort dem
// /**
//  * Sekvens med extra felsökningsmöjligheter
//  */
// class DebuggableSequence extends BaseSequence {
// 	constructor() {
// 		super();
// 		this._sent = {};
// 	}

// 	// Felsökningsfunktioner
// 	/**
// 	 * Ett objekt som bekriver vilka objekt som skapats hittills
// 	 */
// 	get sent() {
// 		return this._sent;
// 	}

// 	/**
// 	 * Ett objekt som beskriver hur många objekt som skapas i sekvensen
// 	 */
// 	get summary() {
// 		if (!this.iterating || !this._summary)
// 			this._summary = this.totalSequence.concat(this.currentSequence).reduce((tot, ins) => {
// 				if (ins[0] === "spawn")
// 					tot[ins[1].name] = (tot[ins[1].name] || 0) + 1;

// 				return tot;
// 			}, {});

// 		return this._summary;
// 	}

// 	/**
// 	 * Ett objekt som beskriver hur många objekt som är kvar att skicka
// 	 */
// 	get remaining() {
// 		let smry = this.summary;
// 		if (!this.iterating)
// 			return smry;
// 		let sent = this.sent;
// 		let rem = {};

// 		for (let t in smry)
// 			rem[t] = smry[t] - (sent[t] || 0);

// 		return rem;
// 	}

// 	/**
// 	 * Ett objekt som mappar klassnamn till dess typ, för alla objekt som kommer spawnas av denna sekvens.
// 	 */
// 	get codebook() {
// 		return this.totalSequence.concat(this.currentSequence).reduce((tot, ins) => {
// 			if (ins[0] === "spawn" && !tot[ins[1].name])
// 				tot[ins[1].name] = ins[1];

// 			return tot;
// 		}, {});
// 	}

// 	/**
// 	 * Köa ett visst antal objekt. Följs av immediately(), over() eller spaced().
// 	 * @param {*} type Objektens typ.
// 	 * @param {Number} number Antalet objekt som ska köas.
// 	 */
// 	spawn(type, number = 1) {
// 		this._summary = null;
// 		return super.spawn(type, number);
// 	}

// 	/**
// 	 * Spawna ett nytt objekt av en viss typ. Kör konstruktorn utan några argument.
// 	 * @param {["spawn", *]} instruction En array med "spawn" först, följt av typen som ska skapas.
// 	 */
// 	doSpawn(instruction) {
// 		this._sent[instruction[1].name] = (this._sent[instruction[1].name] || 0) + 1;
// 		return super.spawn(instruction);
// 	}
// }
