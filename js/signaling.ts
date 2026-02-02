type Callback<T> = (data: T) => unknown;

export class Signal<T = void> {
  private callbacks = new Set<Callback<T>>();

  attach(callback: Callback<T>) {
    this.callbacks.add(callback);
  }

  detach(callback: Callback<T>) {
    this.callbacks.delete(callback);
  }

  invoke(data: T) {
    this.callbacks.forEach((cb) => cb(data));
  }
}

// Tidigare försök
export class SignalObserver {
  private callbacks = new Map<string, ((args: never) => unknown)[]>();

  register(name: string, callback: (args: never) => unknown) {
    let array = this.callbacks.get(name);
    if (array === undefined) {
      array = [];
      this.callbacks.set(name, array);
    }
    array.push(callback);
  }

  unregister(name: string, callback: (arg: never) => unknown): boolean {
    const array = this.callbacks.get(name);
    const index = array?.indexOf(callback) ?? -1;
    if (index === -1) {
      return false;
    }
    array!.splice(index, 1);
    return true;
  }

  /**
   * Invokes all callbacks registered under `name` with `data`.
   */
  send(name: string, data: unknown = null) {
    this.callbacks.get(name)?.forEach((callback) => callback(data as never));
  }
}
