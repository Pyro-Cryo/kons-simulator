type Callback<T> = (data: T) => void;
type CallbackHandle = number;

export class Signal<T = void> {
  private nextId: CallbackHandle = 0;
  private readonly callbacks = new Map<CallbackHandle, Callback<T>>();

  attach(callback: Callback<T>): CallbackHandle {
    const id = this.nextId++;
    this.callbacks.set(id, callback);
    return id;
  }

  attachOnce(callback: Callback<T>): CallbackHandle {
    const id = this.nextId++;
    const callbackWithDeletion = (data: T) => {
      callback(data);
      this.detach(id);
    };
    this.attach(callbackWithDeletion);
    return id;
  }

  next(): Promise<T> {
    return new Promise((resolve) => this.attachOnce(resolve));
  }

  detach(handle: CallbackHandle): boolean {
    return this.callbacks.delete(handle);
  }

  invoke(data: T) {
    for (const callback of this.callbacks.values()) {
      try {
        callback(data);
      } catch (e) {
        console.error(e);
      }
    }
  }

  derive(): Signal<T> {
    const signal = new Signal<T>();
    this.attach((data) => signal.invoke(data));
    return signal;
  }

  map<T2>(transform: (data: T) => T2): Signal<T2> {
    const signal = new Signal<T2>();
    this.attach((data: T) => signal.invoke(transform(data)));
    return signal;
  }

  filter(precondition: (data: T) => boolean): Signal<T> {
    const signal = new Signal<T>();
    this.attach((data: T) => (precondition(data) ? signal.invoke(data) : null));
    return signal;
  }
}
