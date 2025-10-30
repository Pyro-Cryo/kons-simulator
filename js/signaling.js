class SignalObserver {
  constructor() {
    /** @type {Map<string, Array<function(any):any>} */
    this._callbacks = new Map();
  }

  /**
   * @param {string} name
   * @param {function(any):any} callback
   */
  register(name, callback) {
    let array = this._callbacks.get(name);
    if (array === undefined) {
      array = [];
      this._callbacks.set(name, array);
    }
    array.push(callback);
  }

  /**
   * @param {string} name
   * @param {function(any):any} callback
   * @returns {boolean} Whether the callback was previously registered.
   */
  unregister(name, callback) {
    const array = this._callbacks.get(name);
    const index = array?.indexOf(callback) ?? -1;
    if (index === -1) return false;
    array.splice(index, 1);
    return true;
  }

  /**
   * Invokes all callbacks registered under `name` with `data`.
   * @param {string} name
   * @param {any} data
   */
  send(name, data = null) {
    this._callbacks.get(name)?.forEach((callback) => callback(data));
  }
}
