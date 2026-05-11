import {toString} from './utils.js';

type JsonPrimitive = number | string | boolean | null;
/**
 * Objects and primitives that can be natively handled by the JSON parser.
 */
export type NativelySerializable =
  | JsonPrimitive
  | {[key: string]: NativelySerializable}
  | Array<NativelySerializable>;

/**
 * We support symbols and undefined in the intermediate layer of serialization,
 * in addition to the regular JSON primitives, objects, and arrays.
 */
export type Serializable =
  | JsonPrimitive
  | symbol
  | undefined
  | {[key: string]: Serializable} // Close enough.
  | Array<Serializable>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Type = abstract new (...args: any[]) => any;
interface InstanceWithSerializer<S> {
  serialize(): S;
}
/**
 * A class definition that specifies a serializer on its instances and a static
 * deserializer.
 */
export interface SerializableClass<T extends InstanceWithSerializer<S>, S>
  extends Type {
  deserialize(serialized: S): T;
}

// interface SerializableClass<S, T> {
//   // new(...args: ConstructorParameters<this>): T;
//   deserialize(serialized: S): T;
// }

const TYPE = '#type';
const VALUE = '#val';
const UNDEFINED_KEY = 'undefined';
const SYMBOL_KEY = 'Symbol';

interface SerializerWithKey {
  key: string;
  serializer: (value: never) => unknown;
}

/**
 * Extra functionality for serializing and deserializing more JSON objects,
 * including Sets, Maps, custom classes, Symbols, undefined).
 */
export class JsonSerializer {
  private readonly symbols = new Map<string, symbol>();
  private readonly serializers = new Map<Type, SerializerWithKey>();
  private readonly deserializers = new Map<string, (value: never) => unknown>();

  constructor() {
    // Add undefined and symbol deserializers so we can skip some special cases
    // in backwardPass.
    this.deserializers.set(UNDEFINED_KEY, (_) => undefined);
    this.deserializers.set(SYMBOL_KEY, (description: string) =>
      this.deserializeSymbol(description)
    );
    // Other common collections.
    this.addClass(
      Set,
      (set) => Array.from(set),
      (array) => new Set(array)
    );
    this.addClass(
      Map,
      (map) => Array.from(map),
      (array) => new Map(array)
    );
  }

  /** Register a symbol so that it can be (de)serialized. */
  addSymbol(symbol: symbol) {
    if (!symbol.description) {
      throw new Error(`Symbol has no description: ${String(symbol)}`);
    }
    if (this.symbols.has(symbol.description)) {
      throw new Error(`Symbol already registered: ${String(symbol)}`);
    }
    this.symbols.set(symbol.description, symbol);
  }

  private serializeSymbol(symbol: symbol) {
    if (symbol.description === undefined) {
      throw new Error(`Symbol without description: ${String(symbol)}`);
    }
    if (!this.symbols.has(symbol.description)) {
      throw new Error(`Symbol not registered: ${String(symbol)}`);
    }
    return {[TYPE]: SYMBOL_KEY, [VALUE]: symbol.description};
  }

  private deserializeSymbol(description: string): symbol {
    if (!this.symbols.has(description)) {
      console.warn(`Deserializing unregistered symbol: ${description}`);
      // Register the symbol so that all its occurences in the deserialized data
      // will at least point to the same instance.
      this.addSymbol(Symbol(description));
    }
    return this.symbols.get(description)!;
  }

  /**
   * Register a class to make it serializable.
   * @param type The type to register.
   * @param serializer A function that deconstructs an instance of `type` into a
   *   Serializable.
   * @param deserializer A function that constructs an instance of `type` given
   *   a Serializable returned by the serializer.
   * @param key The "key" used to disambiguate different types after they have
   *   been serialized. Defaults to the name of the Type. Must be unique.
   */
  addClass<T extends Type, S>(
    type: T,
    serializer: (instance: InstanceType<NoInfer<T>>) => S,
    deserializer: (serialized: S) => InstanceType<NoInfer<T>>,
    key?: string
  ) {
    key ??= type.name;
    if (this.serializers.has(type)) {
      throw new Error(
        `A serializer is already registered for type: ${type.name}`
      );
    }
    if (this.deserializers.has(key)) {
      throw new Error(`A deserializer is already registered for key: ${key}`);
    }
    this.serializers.set(type, {key, serializer});
    this.deserializers.set(key, deserializer);
  }

  /**
   * Register a class to make it serializable.
   * @param type The type to register.
   * @param key The "key" used to disambiguate different types after they have
   *   been serialized. Defaults to the name of the Type. Must be unique.
   */
  addSerializableClass<S, I extends InstanceWithSerializer<S>>(
    type: SerializableClass<I, S>,
    key?: string
  ) {
    this.addClass(
      type,
      (instance) => instance.serialize(),
      (serialized) => type.deserialize(serialized),
      key
    );
  }

  /**
   * Recursively applies predefined and custom serializers to construct a value
   * that can be handled by the regular JSON serializer.
   */
  private forwardPass(value: unknown): NativelySerializable {
    if (value === null) {
      return value;
    }
    switch (typeof value) {
      case 'boolean':
      case 'string':
      case 'number':
        return value;
      case 'undefined':
        return {[TYPE]: UNDEFINED_KEY};
      case 'symbol':
        return this.serializeSymbol(value);
      case 'function': // Could maybe be implemented similarly to objects.
      case 'bigint': // Can't be bothered.
        throw new Error(`Not supported: ${typeof value}`);
    }
    if (value instanceof Array) {
      // Process all elements in the array.
      return value.map((element: unknown) => this.forwardPass(element));
    }
    if (value?.constructor === Object) {
      if (TYPE in (value as object) || VALUE in (value as object)) {
        throw new Error(
          `Objects to serialize may not contain keys '${TYPE}' or ` +
            `'${VALUE}', got: ${toString(value)}`
        );
      }
      // Recurse into all values. Symbol keys will be dropped.
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, this.forwardPass(v)])
      );
    }

    const serializerWithKey = this.serializers.get(value?.constructor as Type);
    if (!serializerWithKey) {
      throw new Error(
        `No serializer for type: ${value?.constructor.name} (got ${value}))`
      );
    }

    const {key, serializer} = serializerWithKey;
    const serialized = this.forwardPass(serializer(value as never));
    if (
      typeof serialized === 'object' &&
      serialized !== null &&
      !(serialized instanceof Array) &&
      !(TYPE in serialized)
    ) {
      // Insert type information so it can be deserialized.
      serialized[TYPE] = key;
      return serialized;
    }
    // Primitives and arrays are wrapped to attach type information.
    return {[TYPE]: key, [VALUE]: serialized};
  }

  /**
   * Recursively applies predefined and custom deserializers on a plain JSON
   * value to reconstruct custom objects.
   */
  private backwardPass(value: NativelySerializable): unknown {
    if (value === null || typeof value !== 'object') {
      return value;
    }
    if (value instanceof Array) {
      // Process all elements in the array.
      return value.map((element: NativelySerializable) =>
        this.backwardPass(element)
      );
    }

    const key = value[TYPE] as string | undefined;
    if (key === undefined) {
      // Plain objects do not get a type key when serialized.
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [k, this.backwardPass(v)])
      );
    }

    const deserializer = this.deserializers.get(key);
    if (deserializer === undefined) {
      throw new Error(`No deserializer for key ${key}`);
    }
    if (VALUE in value) {
      value = value[VALUE];
    } else {
      delete value[TYPE];
    }
    return deserializer(this.backwardPass(value) as never);
  }

  /** Serializes the provided value to a plain, JSON-serializable value. */
  toNative(value: unknown): NativelySerializable {
    return this.forwardPass(value);
  }

  /** Reconstructs custom objects from a plain, JSON-serializable value. */
  fromNative(native: NativelySerializable): unknown {
    return this.backwardPass(native);
  }

  /**
   * Serializes the provided value to a JSON string.
   * @param value The value to serialize.
   * @param pretty Whether to add indentation to the string.
   * @returns The serialized string.
   */
  stringify(value: unknown, pretty: boolean = false) {
    return JSON.stringify(
      this.toNative(value),
      undefined,
      pretty ? 2 : undefined
    );
  }

  /**
   * Parses the given JSON string, applying the custom deserializers.
   * @param string The result of a call to stringify().
   * @returns The deserialized object.
   */
  parse(string: string): unknown {
    return this.fromNative(JSON.parse(string));
  }
}

export const TEST_ONLY = {TYPE};
