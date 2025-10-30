let _Resource__loadedAssets = new Map();
let _Resource__registeredAssets = new Map();
let _Resource__assetsDirty = false;
let _Resource__assetsCurrentlyLoading = false;

export class Resource {
  /**
   * Ger ett Promise som resolvas när alla de listade sakerna hämtats (eller
   * någon failar).
   * @param {any[][]} resources En array med saker att hämta. Dessa är i sig
   * 		arrayer: [path, type, map, onErr]. De första tre motsvarar argumenten
   * 		till loadSingle(). onErr körs om inte objektet kan hämtas.
   * @param {*} defaultType Om en array i resources inte specificerar en typ
   * 		används denna.
   * @param {Function} onUpdate Körs varje gång ett objekt har hämtats (och
   * 		onload körts). Kan t.ex. användas för loading bars.
   */
  static load(resources, defaultType = Image, onUpdate = null) {
    let progress = 0;
    let items = [];

    const singleResource = typeof resources === 'string';
    if (singleResource) resources = [resources];

    for (let resource of resources) {
      if (typeof resource === 'string') resource = [resource];

      let path = resource[0];
      let type = resource.length >= 2 ? resource[1] : defaultType;
      let map = resource.length >= 3 ? resource[2] : null;
      let onErr = resource.length >= 4 ? resource[3] : null;

      let promise = this.loadSingle(path, type, map, onErr);

      if (onErr) promise = promise.catch(onErr);

      promise = promise.finally(() => {
        progress++;
        if (onUpdate) onUpdate(progress, items.length);
      });

      items.push(promise);
    }
    if (singleResource) return items[0];
    else return Promise.all(items);
  }

  /**
   * Ger ett promise som resolvas när saken hämtats.
   * @param {string} path URI till objektet.
   * @param {*} type Vad för slags objekt det är som hämtas (ex. Image, Audio).
   * @param {Function} map Anropas med objektet när det hämtats. Om ett
   * 		returvärde ges skickas det vidare till det promise som returneras av
   *    `loadSingle()`.
   */
  static loadSingle(path, type = Image, map = null) {
    let promise;
    if (type === JSON)
      promise = new Promise((resolve, reject) => {
        fetch(path)
          .then((response) => {
            if (response.ok) resolve(response.json());
            else reject(response);
          })
          .catch((reason) => reject(reason));
      });
    else if (type === String)
      promise = new Promise((resolve, reject) => {
        fetch(path)
          .then((response) => {
            if (response.ok) resolve(response.text());
            else reject(response);
          })
          .catch((reason) => reject(reason));
      });
    else if (type === ArrayBuffer)
      promise = new Promise((resolve, reject) => {
        fetch(path)
          .then((response) => {
            if (response.ok) resolve(response.arrayBuffer());
            else reject(response);
          })
          .catch((reason) => reject(reason));
      });
    else
      promise = new Promise((resolve, reject) => {
        try {
          const item = new type();
          if (item instanceof Audio) {
            let needsResolving = true;
            item.addEventListener('canplaythrough', () => {
              if (needsResolving) {
                needsResolving = false;
                resolve(item);
              }
            });
            item.preload = true;
            const interval = setInterval(() => {
              if (item.readyState === 4 && needsResolving) {
                needsResolving = false;
                resolve(item);
              }
              if (!needsResolving) {
                clearInterval(interval);
              }
            }, 1000);

            setTimeout(() => {
              // iOS vill inte läsa in saker, yolo
              resolve(item);
              needsResolving = false;
            }, 5000);
          } else item.addEventListener('load', () => resolve(item));
          item.addEventListener('error', reject);
          item.src = path;
          if (item instanceof Audio) item.load();
        } catch (e) {
          reject(e);
        }
      });

    if (map) promise = promise.then((item) => this._applyMap(item, map));

    return promise;
  }

  static _applyMap(item, map) {
    const mappedItem = map(item);
    if (mappedItem === undefined) return item;
    else return mappedItem;
  }

  static get _loadedAssets() {
    return _Resource__loadedAssets;
  }
  static set _loadedAssets(value) {
    _Resource__loadedAssets = value;
  }
  static get _registeredAssets() {
    return _Resource__registeredAssets;
  }
  static set _registeredAssets(value) {
    _Resource__registeredAssets = value;
  }
  static get _assetsDirty() {
    return _Resource__assetsDirty;
  }
  static set _assetsDirty(value) {
    _Resource__assetsDirty = value;
  }
  static get _assetsCurrentlyLoading() {
    return _Resource__assetsCurrentlyLoading;
  }
  static set _assetsCurrentlyLoading(value) {
    _Resource__assetsCurrentlyLoading = value;
  }
  static get assetsLoaded() {
    return !this._assetsDirty;
  }

  /**
   * Registrerar ett objekt som en asset. Dessa hämtas med loadAssets() och
   * cacheas så de kan kommas åt med getAsset().
   * @param {string} path URI till objektet.
   * @param {*} type Vad för slags objekt det är som hämtas (ex. Image, Audio).
   * @param {Function} map Anropas med objektet när det hämtats. Om ett
   * 		returvärde ges skickas det vidare till det promise som returneras av
   * 		loadSingle().
   * @returns Den URI som angavs.
   */
  static addAsset(path, type = Image, map = null) {
    if (this._assetsCurrentlyLoading)
      throw new Error('Cannot add assets while assets are currently loading.');

    this._registeredAssets.set(path, [type, map]);

    if (this._loadedAssets.has(path)) {
      this._loadedAssets.delete(path);
      console.warn('Overwriting or reloading asset: ' + path);
    }

    this._assetsDirty = true;

    return path;
  }

  static getAsset(path, checkDirty = true) {
    if (checkDirty && this._assetsDirty)
      throw new Error('All assets not loaded');

    if (this._loadedAssets.has(path)) return this._loadedAssets.get(path);
    else if (!checkDirty && this._registeredAssets.has(path))
      throw new Error('Asset not yet loaded: ' + path);
    else throw new Error('Asset not registered: ' + path);
  }

  static loadAssets(onUpdate = null) {
    if (this._assetsDirty) {
      this._assetsCurrentlyLoading = true;

      let resources = Array.from(this._registeredAssets)
        .map((assetSpec) => [
          assetSpec[0], // path
          assetSpec[1][0], // type
          (item) => {
            // map
            if (assetSpec[1][1]) item = this._applyMap(item, assetSpec[1][1]);
            this._loadedAssets.set(assetSpec[0], item);
            return item;
          },
          (info) => {
            const error = new Error(
              `Failed to load asset ${assetSpec[0]} as ${assetSpec[1][0].name}`
            );
            error.additionalInfo = info;
            throw error;
          },
        ])
        .filter((assetSpec) => !this._loadedAssets.has(assetSpec[0]));

      // Defaulttypen behövs inte då alla assets definierar egna
      return this.load(resources, null, onUpdate).then((_) => {
        this._assetsDirty = false;
        this._assetsCurrentlyLoading = false;
      });
    } else {
      return new Promise((resolve, _) => resolve());
    }
  }
}
