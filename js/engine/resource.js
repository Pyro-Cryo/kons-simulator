"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Resource = void 0;
var _Resource__loadedAssets = new Map();
var _Resource__registeredAssets = new Map();
var _Resource__assetsDirty = false;
var _Resource__assetsCurrentlyLoading = false;
var Resource = /** @class */ (function () {
    function Resource() {
    }
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
    Resource.load = function (resources, defaultType, onUpdate) {
        if (defaultType === void 0) { defaultType = Image; }
        if (onUpdate === void 0) { onUpdate = null; }
        var progress = 0;
        var items = [];
        var singleResource = typeof resources === 'string';
        if (singleResource)
            resources = [resources];
        for (var _i = 0, resources_1 = resources; _i < resources_1.length; _i++) {
            var resource = resources_1[_i];
            if (typeof resource === 'string')
                resource = [resource];
            var path = resource[0];
            var type = resource.length >= 2 ? resource[1] : defaultType;
            var map = resource.length >= 3 ? resource[2] : null;
            var onErr = resource.length >= 4 ? resource[3] : null;
            var promise = this.loadSingle(path, type, map, onErr);
            if (onErr)
                promise = promise.catch(onErr);
            promise = promise.finally(function () {
                progress++;
                if (onUpdate)
                    onUpdate(progress, items.length);
            });
            items.push(promise);
        }
        if (singleResource)
            return items[0];
        else
            return Promise.all(items);
    };
    /**
     * Ger ett promise som resolvas när saken hämtats.
     * @param {string} path URI till objektet.
     * @param {*} type Vad för slags objekt det är som hämtas (ex. Image, Audio).
     * @param {Function} map Anropas med objektet när det hämtats. Om ett
     * 		returvärde ges skickas det vidare till det promise som returneras av
     *    `loadSingle()`.
     */
    Resource.loadSingle = function (path, type, map) {
        var _this = this;
        if (type === void 0) { type = Image; }
        if (map === void 0) { map = null; }
        var promise;
        if (type === JSON)
            promise = new Promise(function (resolve, reject) {
                fetch(path)
                    .then(function (response) {
                    if (response.ok)
                        resolve(response.json());
                    else
                        reject(response);
                })
                    .catch(function (reason) { return reject(reason); });
            });
        else if (type === String)
            promise = new Promise(function (resolve, reject) {
                fetch(path)
                    .then(function (response) {
                    if (response.ok)
                        resolve(response.text());
                    else
                        reject(response);
                })
                    .catch(function (reason) { return reject(reason); });
            });
        else if (type === ArrayBuffer)
            promise = new Promise(function (resolve, reject) {
                fetch(path)
                    .then(function (response) {
                    if (response.ok)
                        resolve(response.arrayBuffer());
                    else
                        reject(response);
                })
                    .catch(function (reason) { return reject(reason); });
            });
        else
            promise = new Promise(function (resolve, reject) {
                try {
                    var item_1 = new type();
                    if (item_1 instanceof Audio) {
                        var needsResolving_1 = true;
                        item_1.addEventListener('canplaythrough', function () {
                            if (needsResolving_1) {
                                needsResolving_1 = false;
                                resolve(item_1);
                            }
                        });
                        item_1.preload = true;
                        var interval_1 = setInterval(function () {
                            if (item_1.readyState === 4 && needsResolving_1) {
                                needsResolving_1 = false;
                                resolve(item_1);
                            }
                            if (!needsResolving_1) {
                                clearInterval(interval_1);
                            }
                        }, 1000);
                        setTimeout(function () {
                            // iOS vill inte läsa in saker, yolo
                            resolve(item_1);
                            needsResolving_1 = false;
                        }, 5000);
                    }
                    else
                        item_1.addEventListener('load', function () { return resolve(item_1); });
                    item_1.addEventListener('error', reject);
                    item_1.src = path;
                    if (item_1 instanceof Audio)
                        item_1.load();
                }
                catch (e) {
                    reject(e);
                }
            });
        if (map)
            promise = promise.then(function (item) { return _this._applyMap(item, map); });
        return promise;
    };
    Resource._applyMap = function (item, map) {
        var mappedItem = map(item);
        if (mappedItem === undefined)
            return item;
        else
            return mappedItem;
    };
    Object.defineProperty(Resource, "_loadedAssets", {
        get: function () {
            return _Resource__loadedAssets;
        },
        set: function (value) {
            _Resource__loadedAssets = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Resource, "_registeredAssets", {
        get: function () {
            return _Resource__registeredAssets;
        },
        set: function (value) {
            _Resource__registeredAssets = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Resource, "_assetsDirty", {
        get: function () {
            return _Resource__assetsDirty;
        },
        set: function (value) {
            _Resource__assetsDirty = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Resource, "_assetsCurrentlyLoading", {
        get: function () {
            return _Resource__assetsCurrentlyLoading;
        },
        set: function (value) {
            _Resource__assetsCurrentlyLoading = value;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Resource, "assetsLoaded", {
        get: function () {
            return !this._assetsDirty;
        },
        enumerable: false,
        configurable: true
    });
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
    Resource.addAsset = function (path, type, map) {
        if (type === void 0) { type = Image; }
        if (map === void 0) { map = null; }
        if (this._assetsCurrentlyLoading)
            throw new Error('Cannot add assets while assets are currently loading.');
        this._registeredAssets.set(path, [type, map]);
        if (this._loadedAssets.has(path)) {
            this._loadedAssets.delete(path);
            console.warn('Overwriting or reloading asset: ' + path);
        }
        this._assetsDirty = true;
        return path;
    };
    Resource.getAsset = function (path, checkDirty) {
        if (checkDirty === void 0) { checkDirty = true; }
        if (checkDirty && this._assetsDirty)
            throw new Error('All assets not loaded');
        if (this._loadedAssets.has(path))
            return this._loadedAssets.get(path);
        else if (!checkDirty && this._registeredAssets.has(path))
            throw new Error('Asset not yet loaded: ' + path);
        else
            throw new Error('Asset not registered: ' + path);
    };
    Resource.loadAssets = function (onUpdate) {
        var _this = this;
        if (onUpdate === void 0) { onUpdate = null; }
        if (this._assetsDirty) {
            this._assetsCurrentlyLoading = true;
            var resources = Array.from(this._registeredAssets)
                .map(function (assetSpec) { return [
                assetSpec[0], // path
                assetSpec[1][0], // type
                function (item) {
                    // map
                    if (assetSpec[1][1])
                        item = _this._applyMap(item, assetSpec[1][1]);
                    _this._loadedAssets.set(assetSpec[0], item);
                    return item;
                },
                function (info) {
                    var error = new Error("Failed to load asset ".concat(assetSpec[0], " as ").concat(assetSpec[1][0].name));
                    error.additionalInfo = info;
                    throw error;
                },
            ]; })
                .filter(function (assetSpec) { return !_this._loadedAssets.has(assetSpec[0]); });
            // Defaulttypen behövs inte då alla assets definierar egna
            return this.load(resources, null, onUpdate).then(function (_) {
                _this._assetsDirty = false;
                _this._assetsCurrentlyLoading = false;
            });
        }
        else {
            return new Promise(function (resolve, _) { return resolve(); });
        }
    };
    return Resource;
}());
exports.Resource = Resource;
//# sourceMappingURL=resource.js.map