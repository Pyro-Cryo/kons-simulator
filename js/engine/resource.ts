type Constructor<T> = new () => T;
type ResourceType<T> = Constructor<T> | typeof JSON | string | ArrayBuffer;
type OnUpdate = (progress: number, total: number) => void;

export interface Asset<T> {
  /** Hämta objektet från cachen. */
  get(): T;
}

interface AssetSpec<T, V> {
  /** URI för objektet som ska hämtas. */
  path: string;
  /** Typen som objektet ska läsas in som. */
  type: ResourceType<T>;
  /**
   * Mappning som appliceras på objektet efter att det lästs in men innan det
   * cacheas.
   */
  map: (item: T) => V;
  /** Körs om vi misslyckas med att hämta ett objekt. */
  onError: (reason: unknown) => void;
}

interface RegisteredAsset<T, V> {
  type: ResourceType<T>;
  map?: (item: T) => V;
}

class Resources {
  private registeredAssets = new Map<
    string,
    RegisteredAsset<unknown, unknown>
  >();
  private loadedAssets = new Map<string, unknown>();
  private assetsDirty = false;
  private assetsCurrentlyLoading = false;

  /**
   * Registrerar ett objekt som en asset. Dessa hämtas med loadAssets() och
   * cacheas så de kan kommas åt med getAsset().
   * @param path URI till objektet.
   * @param type Vad för slags objekt det är som hämtas (ex. Image, Audio).
   * @param map Optional transform för det hämtade objektet, innan det sätts in
   *     i cachen.
   * @returns Ett objekt som kan användas för att komma åt objektet som hämtats.
   */
  addAsset(
    path: string,
    type: ResourceType<unknown> = Image,
    map?: (item: unknown) => unknown
  ): Asset<unknown> {
    if (this.assetsCurrentlyLoading)
      throw new Error('Cannot add assets while assets are currently loading.');

    this.registeredAssets.set(path, {type, map});

    if (this.loadedAssets.has(path)) {
      this.loadedAssets.delete(path);
      console.warn('Overwriting or reloading asset: ' + path);
    }

    this.assetsDirty = true;

    return {get: () => this.getAsset(path)};
  }

  /**
   * Hämta en asset från cachen. Misslyckas om objekten inte laddats ännu.
   * @param path URI till objektet.
   * @param checkDirty Sätt till false för att hämta ett visst objekt innan
   *     övriga objekt hämtats färdigt.
   */
  getAsset(path: string, checkDirty = true) {
    if (checkDirty && this.assetsDirty)
      throw new Error('All assets not loaded');

    if (this.loadedAssets.has(path)) return this.loadedAssets.get(path);
    else if (!checkDirty && this.registeredAssets.has(path))
      throw new Error('Asset not yet loaded: ' + path);
    else throw new Error('Asset not registered: ' + path);
  }

  async loadAssets(onUpdate?: OnUpdate): Promise<void> {
    if (!this.assetsDirty) {
      return new Promise<void>((resolve, _) => resolve());
    }
    this.assetsCurrentlyLoading = true;

    const resources = Array.from(this.registeredAssets)
      .map(([path, {type, map}]) => ({
        path,
        type,
        map: <T, V>(item: T): T | V => {
          const mappedItem = map ? (map(item) as V) : item;
          this.loadedAssets.set(path, mappedItem);
          return mappedItem;
        },
        onError: <T>(info: T) => {
          const name =
            typeof type !== 'string' && 'name' in type ? type.name : type;
          const error = new Error(
            `Failed to load asset ${path} as ${name}`
          ) as Error & {additionalInfo: T};
          error.additionalInfo = info;
          throw error;
        },
      }))
      .filter((assetSpec) => !this.loadedAssets.has(assetSpec.path));

    // Defaulttypen behövs inte då alla assets definierar egna
    await this.load(resources, onUpdate);
    this.assetsDirty = false;
    this.assetsCurrentlyLoading = false;
  }

  /**
   * Ger ett Promise som resolvas när alla de listade sakerna hämtats (eller
   * någon failar).
   * @param resources En array med saker att hämta.
   * @param onUpdate Körs varje gång ett objekt har hämtats (och
   *     onload körts). Kan t.ex. användas för loading bars.
   */
  private load(resources: AssetSpec<unknown, unknown>[], onUpdate?: OnUpdate) {
    let progress = 0;
    const items = [];

    for (const {path, type, map, onError} of resources) {
      let promise = loadSingle(path, type, map);

      if (onError) promise = promise.catch(onError);

      promise = promise.finally(() => {
        progress++;
        if (onUpdate) onUpdate(progress, items.length);
      });

      items.push(promise);
    }
    return Promise.all(items);
  }
}

const RESPONSE_GETTERS = new Map<unknown, (response: Response) => unknown>([
  [JSON, (response: Response) => response.json()],
  [String, (response: Response) => response.text()],
  [ArrayBuffer, (response: Response) => response.arrayBuffer()],
]);

/**
 * Ger ett promise som resolvas när saken hämtats.
 * @param path URI till objektet.
 * @param type Vad för slags objekt det är som hämtas (ex. Image, Audio).
 * @param map Anropas med objektet när det hämtats. Om ett
 *     returvärde ges skickas det vidare till det promise som returneras av
 *     `loadSingle()`.
 */
function loadSingle(
  path: string,
  type: ResourceType<unknown> = Image,
  map?: (item: unknown) => unknown
): Promise<unknown> {
  let promise;
  const getter = RESPONSE_GETTERS.get(type);
  if (getter) {
    promise = new Promise((resolve, reject) => {
      fetch(path)
        .then((response) => {
          if (response.ok) resolve(getter(response));
          else reject(response);
        })
        .catch((reason) => reject(reason));
    });
  } else {
    promise = new Promise((resolve, reject) => {
      try {
        const item = new (type as Constructor<unknown>)() as {
          src: string;
        } & EventTarget;
        if (item instanceof Audio) {
          let needsResolving = true;
          item.addEventListener('canplaythrough', () => {
            if (needsResolving) {
              needsResolving = false;
              resolve(item);
            }
          });
          item.preload = 'auto';
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
        } else {
          item.addEventListener('load', () => resolve(item));
        }
        item.addEventListener('error', reject);
        item.src = path;
        if (item instanceof Audio) item.load();
      } catch (e) {
        reject(e);
      }
    });
  }

  if (map) promise = promise.then(map);

  return promise;
}

const RESOURCES = new Resources();

/**
 * Registrerar ett objekt som en asset. Dessa hämtas med loadAssets() och
 * cacheas så de kan kommas åt med det returnerade objektets get()-metod.
 * @param path URI till objektet.
 * @param type Vad för slags objekt det är som hämtas (ex. Image, Audio).
 * @param map Optional transform för det hämtade objektet, innan det sätts in
 *     i cachen.
 * @returns Ett objekt som kan användas för att komma åt objektet som hämtats.
 */
export function addAsset(path: string): Asset<HTMLImageElement>;
export function addAsset<T extends {src: string}>(
  path: string,
  type: ResourceType<T>
): Asset<T>;
export function addAsset<T extends {src: string}, V>(
  path: string,
  type: ResourceType<T>,
  map: (item: T) => V
): Asset<V>;
export function addAsset(
  path: string,
  type: ResourceType<unknown> = Image,
  map?: (item: unknown) => unknown
): Asset<unknown> {
  return RESOURCES.addAsset(path, type, map);
}

/**
 * Ger ett Promise som resolvas när alla registrerade assets har hämtats (eller
 * något misslyckats).
 * @param onUpdate Callback som körs efter varje hämtat objekt. Kan t.ex.
 *     användas för loading bars.
 */
export async function loadAssets(onUpdate?: OnUpdate): Promise<void> {
  return RESOURCES.loadAssets(onUpdate);
}

