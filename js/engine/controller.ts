import {GameArea, GridOrigin} from './gameArea.js';
import {loadAssets} from './resource.js';
import {LinkedList} from './containers.js';

interface GameObjectInterface {
  id: number | null;
  update(delta: number): void;
  draw(gameArea: GameArea): void;
  translate(dx: number, dy: number): void;
}

const _Controller__instances: Controller[] = [];
export class Controller {
  static get isSingleInstance() {
    return _Controller__instances.length === 1;
  }
  static get instance() {
    if (this.isSingleInstance) {
      return _Controller__instances[0];
    }
    throw new Error(
      'Multiple controllers exist: ' + _Controller__instances.length
    );
  }

  protected WIDTH_PX: number | null = null;
  protected HEIGHT_PX: number | null = null;
  protected STORAGE_PREFIX: string = 'kelvin_';

  public readonly gameArea: GameArea;
  private useAnimationFrameForUpdate: boolean;
  private mainInterval: number | null = null;
  private timestampLast: number | null = null;
  protected isPaused: boolean = true;
  /** Whether the game is currently being fast-forwarded. */
  protected isFF: boolean = false;
  protected readonly minDelta: number = 0;
  protected readonly maxDelta: number = 1000 / 24; // about 42 ms
  protected readonly abandonFrameDeltaThreshold: number = this.maxDelta * 2;
  protected _fastForwardFactor: number = 3;
  private drawLoop: number | null = null;
  protected clearOnDraw: boolean = true;

  /** The ID of the next registered object. */
  protected idCounter: number = 0;
  /** Layers holding all objects that receive update and draw calls. */
  protected layers: LinkedList<GameObjectInterface>[] = [];
  protected currentlyChangingLayers: Map<
    GameObjectInterface,
    {source: number; destination: number}
  > = new Map();
  protected scheduledWorldScroll: {x: number; y: number} = {x: 0, y: 0};

  private playbutton: HTMLElement | null =
    document.getElementById('playButton');
  private ffbutton: HTMLButtonElement | null = document.getElementById(
    'fastForwardButton'
  ) as HTMLButtonElement | null;
  private difficultySelect: HTMLElement | null =
    document.getElementById('difficultySelect');
  private muteButton: HTMLElement | null =
    document.getElementById('muteButton');
  private unmuteButton: HTMLElement | null =
    document.getElementById('unmuteButton');
  private messageBox: HTMLElement | null =
    document.getElementById('messageBox');

  protected audioContext: AudioContext;
  protected volume: number = 0.1;
  protected audioContextGain: GainNode;
  protected audioContextSource: AudioNode | null = null;
  private audioContextSuspendingTimeout: number | null = null;
  private isMuted: boolean;

  constructor(
    canvas: HTMLCanvasElement | string,
    private updateInterval: number | null = null,
    gridWidth: number | null = null,
    gridHeight: number | null = null,
    gridOrigin: GridOrigin = GridOrigin.UPPER_LEFT,
    fastForwardFactor: number = 3,
    // musicFF = true,
    protected cancelFFOnPause: boolean = false
  ) {
    if (!canvas) {
      throw new Error('Canvas not provided');
    }
    if (typeof canvas === 'string') {
      const canvasElement = document.getElementById(canvas);
      if (canvasElement === null) {
        throw new Error(`Could not find canvas element ${canvas}`);
      } else if (!(canvasElement instanceof HTMLCanvasElement)) {
        throw new Error(`Not a canvas element: ${canvas}`);
      }
      canvas = canvasElement;
    }
    if (this.WIDTH_PX !== null) {
      canvas.width = this.WIDTH_PX;
    }
    if (this.HEIGHT_PX !== null) {
      canvas.height = this.HEIGHT_PX;
    }
    this.gameArea = new GameArea(canvas, gridWidth, gridHeight, gridOrigin);

    this.useAnimationFrameForUpdate = this.updateInterval === null;
    this.fastForwardFactor = fastForwardFactor;

    // Buttons
    if (this.playbutton) this.playbutton.onclick = this.togglePause.bind(this);
    if (this.ffbutton) {
      this.ffbutton.onclick = this.toggleFastForward.bind(this);
      this.ffbutton.disabled = this.isPaused;
    }
    if (this.difficultySelect)
      this.difficultySelect.onchange = this.onDifficultyChange.bind(this);

    // Soundtrack stuff.
    this.isMuted = JSON.parse(
      window.localStorage.getItem(this.STORAGE_PREFIX + 'mute') ?? 'false'
    );
    this.audioContext = new AudioContext();
    this.audioContext.suspend();
    this.audioContextGain = new GainNode(this.audioContext, {
      gain: this.volume,
    });
    this.audioContextGain.connect(this.audioContext.destination);
    this.audioContextSuspendingTimeout = null;
    // this.musicSpeedupOnFF = musicFF;
    if (this.muteButton)
      this.muteButton.addEventListener('click', (e) => {
        this.onMute();
        e.preventDefault();
      });
    if (this.unmuteButton)
      this.unmuteButton.addEventListener('click', (e) => {
        this.onUnMute();
        e.preventDefault();
      });

    _Controller__instances.push(this);

    loadAssets(this.onAssetLoadUpdate.bind(this))
      .then(this.onAssetsLoaded.bind(this))
      .catch(this.onAssetsLoadFailure.bind(this));
  }

  set fastForwardFactor(value) {
    if (this.isFF) {
      this.toggleFastForward();
      this._fastForwardFactor = value;
      this.toggleFastForward();
    } else this._fastForwardFactor = value;
  }
  get fastForwardFactor() {
    return this._fastForwardFactor;
  }

  protected startDrawLoop() {
    this.drawLoop = requestAnimationFrame(this.draw.bind(this));
  }
  protected stopDrawLoop() {
    cancelAnimationFrame(this.drawLoop!);
    this.drawLoop = null;
  }

  protected onAssetLoadUpdate(progress: number, total: number) {
    this.setMessage(`Laddar (${progress}/${total}) ...`);
  }
  protected onAssetsLoaded() {}
  protected onAssetsLoadFailure(_: unknown) {}

  protected onDifficultyChange(_: unknown) {}

  togglePause() {
    if (this.isPaused) this.onPlay();
    else this.onPause();
  }

  toggleFastForward() {
    if (this.isFF) {
      if (!this.useAnimationFrameForUpdate) {
        clearInterval(this.mainInterval!);
        this.mainInterval = setInterval(
          () => this.update(),
          this.updateInterval!
        );
      }
      this.isFF = false;
      this.offFastForward();
    } else {
      if (!this.useAnimationFrameForUpdate) {
        clearInterval(this.mainInterval!);
        this.mainInterval = setInterval(
          () => this.update(),
          this.updateInterval! / this._fastForwardFactor
        );
      }
      this.isFF = true;
      this.onFastForward();
    }
  }

  setMusic(
    source: HTMLAudioElement | ArrayBuffer,
    loopStart = 0,
    loopEnd = null
  ) {
    if (source instanceof HTMLAudioElement) {
      this.audioContextSource =
        this.audioContext.createMediaElementSource(source);
      this.audioContextSource.connect(this.audioContextGain);
      source.play();
    } else if (source instanceof ArrayBuffer) {
      this.audioContext.decodeAudioData(source).then((audioBuffer) => {
        this.audioContextSource = new AudioBufferSourceNode(this.audioContext, {
          buffer: audioBuffer,
          loop: true,
          loopStart: loopStart,
          loopEnd: loopEnd ?? audioBuffer.duration,
        });
        this.audioContextSource.connect(this.audioContextGain);
        (this.audioContextSource as AudioBufferSourceNode).start();
      });
    } else {
      let type: string = typeof source;
      if (type === 'object') {
        type = (source as object).constructor.name;
      }
      throw new Error(`Invalid type of music source: ${source} (${type})`);
    }
    // if (this.isFF)
    //     this.currentMusic.playbackRate = Math.sqrt(this.fastForwardFactor);
  }

  protected onMusicPlay() {
    if (this.audioContextSuspendingTimeout !== null) {
      clearTimeout(this.audioContextSuspendingTimeout);
      this.audioContextSuspendingTimeout = null;
    }
    if (this.audioContext.state !== 'running') {
      this.audioContext.resume();
    }
    this.audioContextGain.gain.setValueAtTime(
      this.isMuted ? 0 : this.volume,
      this.audioContext.currentTime + 0.5
    );
  }
  protected onMusicPause() {
    this.audioContextGain.gain.setValueAtTime(
      0,
      this.audioContext.currentTime + 0.5
    );
    if (
      this.audioContext.state === 'running' &&
      this.audioContextSuspendingTimeout === null
    ) {
      this.audioContextSuspendingTimeout = setTimeout(
        () => this.audioContext.suspend(),
        0.75
      );
    }
  }
  setVolume(volume: number) {
    this.volume = volume;
    if (!this.isMuted) {
      this.audioContextGain.gain.linearRampToValueAtTime(
        volume,
        this.audioContext.currentTime + 0.5
      );
    }
  }
  onMute(ramp = true) {
    this.onMusicPause();
    if (!ramp)
      this.audioContextGain.gain.setValueAtTime(
        0,
        this.audioContext.currentTime
      );
    if (this.muteButton) this.muteButton.classList.add('hidden');
    if (this.unmuteButton) this.unmuteButton.classList.remove('hidden');
    this.isMuted = true;
    window.localStorage.setItem(
      this.STORAGE_PREFIX + 'mute',
      JSON.stringify(this.isMuted)
    );
  }
  onUnMute() {
    this.audioContextGain.gain.linearRampToValueAtTime(
      this.volume,
      this.audioContext.currentTime + 0.5
    );
    if (this.muteButton) this.muteButton.classList.remove('hidden');
    if (this.unmuteButton) this.unmuteButton.classList.add('hidden');
    this.isMuted = false;
    window.localStorage.setItem(
      this.STORAGE_PREFIX + 'mute',
      JSON.stringify(this.isMuted)
    );
  }

  onPlay() {
    this.isPaused = false;
    this.timestampLast = null;
    if (this.useAnimationFrameForUpdate)
      this.mainInterval = requestAnimationFrame(this.update.bind(this));
    else
      this.mainInterval = setInterval(
        () => this.update(),
        this.isFF
          ? this.updateInterval! / this._fastForwardFactor
          : this.updateInterval!
      );

    if (this.playbutton) {
      this.playbutton.children[0].classList.add('hidden');
      this.playbutton.children[1].classList.remove('hidden');
    }
    if (this.ffbutton) this.ffbutton.disabled = false;
  }

  onPause() {
    this.isPaused = true;
    if (this.useAnimationFrameForUpdate)
      cancelAnimationFrame(this.mainInterval!);
    else clearInterval(this.mainInterval!);
    this.mainInterval = null;

    if (this.playbutton) {
      this.playbutton.children[0].classList.remove('hidden');
      this.playbutton.children[1].classList.add('hidden');
    }
    if (this.ffbutton) this.ffbutton.disabled = true;
    if (this.cancelFFOnPause) {
      this.isFF = false;
      this.offFastForward();
    }
  }

  onFastForward() {
    this.isFF = true;
    if (this.ffbutton) this.ffbutton.classList.add('keptPressed');
    // if (this.musicSpeedupOnFF && this.currentMusic)
    //     this.currentMusic.playbackRate = Math.sqrt(this.fastForwardFactor);
  }

  offFastForward() {
    this.isFF = false;
    if (this.ffbutton) this.ffbutton.classList.remove('keptPressed');
    // if (this.musicSpeedupOnFF && this.currentMusic)
    //     this.currentMusic.playbackRate = 1;
  }

  setMessage(message: string, pureText = true) {
    if (this.messageBox) {
      if (pureText) this.messageBox.innerText = message;
      else this.messageBox.innerHTML = message;
    } else
      console.warn(
        'Tried to set message, but no message box found: ' + message
      );
  }

  clearMessage() {
    if (this.messageBox) this.messageBox.innerText = '\xa0';
    else console.warn('Tried to clear message, but no message box found.');
  }

  hideMessage() {
    if (this.messageBox) this.messageBox.classList.add('hidden');
    else console.warn('Tried to hide message box, but no message box found');
  }

  // Clear the canvas and let all objects redraw themselves
  update(timestamp?: number) {
    timestamp ??= new Date().getTime();

    // Skip first frame
    if (this.timestampLast === null) {
      if (this.useAnimationFrameForUpdate)
        this.mainInterval = window.requestAnimationFrame(
          this.update.bind(this)
        );
      this.timestampLast = timestamp;
      return;
    }

    let delta = timestamp - this.timestampLast;

    if (delta < this.minDelta) {
      if (this.useAnimationFrameForUpdate)
        this.mainInterval = window.requestAnimationFrame(
          this.update.bind(this)
        );
      return;
    }
    this.timestampLast = timestamp;

    // Prevent single frames with too large delta,
    // which otherwise cause collision detection / physics issues etc.
    if (delta > this.abandonFrameDeltaThreshold) {
      if (this.useAnimationFrameForUpdate)
        this.mainInterval = window.requestAnimationFrame(
          this.update.bind(this)
        );
      return;
    }
    delta = Math.min(this.maxDelta, delta);

    if (this.useAnimationFrameForUpdate && this.isFF)
      delta *= this._fastForwardFactor;

    for (const [obj, change] of this.currentlyChangingLayers.entries()) {
      this.changeLayer(obj, change.source, change.destination);
    }
    this.currentlyChangingLayers.clear();

    for (const layer of this.layers) {
      // Setting an object's id to null indicates it is to be destroyed
      for (const obj of layer.filterIterate((obj) => obj.id !== null)) {
        if (obj.update !== undefined) obj.update(delta);
      }
    }

    if (
      this.scheduledWorldScroll.x !== 0 ||
      this.scheduledWorldScroll.y !== 0
    ) {
      for (const layer of this.layers) {
        for (const obj of layer) {
          if (obj.id !== null)
            obj.translate(
              -this.scheduledWorldScroll.x,
              this.scheduledWorldScroll.y
            );
        }
      }

      this.scheduledWorldScroll.x = 0;
      this.scheduledWorldScroll.y = 0;
    }

    if (this.useAnimationFrameForUpdate)
      this.mainInterval = window.requestAnimationFrame(this.update.bind(this));
  }

  scrollWorld(x: number, y: number) {
    this.scheduledWorldScroll.x += x;
    this.scheduledWorldScroll.y += y;
  }

  draw() {
    if (this.clearOnDraw) this.gameArea.clear();

    for (const layer of this.layers) {
      for (const obj of layer) {
        if (obj.id !== null) obj.draw(this.gameArea);
      }
    }

    this.drawLoop = window.requestAnimationFrame(this.draw.bind(this));
  }

  ensureLayerExists(layer: number) {
    if (layer < 0) {
      throw new Error(`Layer cannot be negative, got: ${layer}`);
    }

    if (layer >= this.layers.length) {
      this.layers = this.layers.concat(
        new Array(layer + 1 - this.layers.length)
          .fill(null)
          .map(() => new LinkedList())
      );
    }
  }

  /**
   * Register an object to receive update calls. It should have an update
   * method, a draw method accepting a GameArea, and allow for setting an id.
   */
  registerObject(object: GameObjectInterface, layer = 0) {
    this.ensureLayerExists(layer);
    this.layers[layer].push(object);
    object.id = this.idCounter++;
  }

  /**
   * Immediately changes the layer of an object. Prefer scheduleLayerChange()
   * during update calls, or some objects may miss an update since the lists
   * are modified while they are being iterated over.
   * @param object
   * @param source The layer that the object is currently in.
   * @param destination The layer that the object should move to.
   */
  changeLayer(
    object: GameObjectInterface,
    source: number,
    destination: number
  ) {
    if (source < 0 || source >= this.layers.length) {
      throw new Error(
        `Invalid source layer: ${source} (number of layers is ` +
          `${this.layers.length})`
      );
    }
    if (!this.layers[source].remove(object)) {
      throw new Error(
        `Object was not present in the source layer, got source: ${source}`
      );
    }
    this.ensureLayerExists(destination);
    this.layers[destination].push(object);
  }

  /**
   * Schedules a layer change before the next update call.
   */
  scheduleLayerChange(
    object: GameObjectInterface,
    source: number,
    destination: number
  ) {
    if (this.currentlyChangingLayers.has(object)) {
      source = this.currentlyChangingLayers.get(object)!.source;
    }
    this.currentlyChangingLayers.set(object, {
      source: source,
      destination: destination,
    });
  }

  // Make the object stop receiving update calls.
  unregisterObject(object: GameObjectInterface) {
    object.id = null;
  }

  unregisterAllObjects() {
    for (const layer of this.layers) {
      for (const obj of layer) {
        obj.id = null;
      }
      layer.clear();
    }
    this.layers = [];
    this.currentlyChangingLayers.clear();
  }

  /**
   * Gets the objects as a flattened array. Not optimized,
   * intended for debugging only.
   */
  get objects() {
    return this.layers.flatMap((layer) => layer.toArray());
  }
}
