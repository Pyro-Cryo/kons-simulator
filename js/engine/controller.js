import {GameArea} from './gameArea.js';
import {Resource} from './resource.js';
import {LinkedList} from './containers.js';

let _Controller__instances = [];
export class Controller {
  static get _instances() {
    return _Controller__instances;
  }
  static set _instances(value) {
    _Controller__instances = value;
  }
  static get isSingleInstance() {
    return this._instances.length === 1;
  }
  /**
   * @type {Controller}
   */
  static get instance() {
    if (this.isSingleInstance) return this._instances[0];
    else
      throw new Error('Multiple controllers exist: ' + this._instances.length);
  }

  static get WIDTH_PX() {
    return null;
  }
  static get HEIGHT_PX() {
    return null;
  }
  static get STORAGE_PREFIX() {
    return 'kelvin_';
  }

  constructor(
    canvas,
    updateInterval = null,
    gridWidth = null,
    gridHeight = null,
    gridOrigin = GameArea.GRID_ORIGIN_UPPER_LEFT,
    fastForwardFactor = 3,
    cancelFFOnPause = false
    // musicFF = true,
  ) {
    if (!canvas) {
      throw new Error('Canvas not provided');
    }
    if (typeof canvas === 'string') canvas = document.getElementById(canvas);
    if (this.constructor.WIDTH_PX !== null) {
      canvas.width = this.constructor.WIDTH_PX;
    }
    if (this.constructor.HEIGHT_PX !== null) {
      canvas.height = this.constructor.HEIGHT_PX;
    }
    this.gameArea = new GameArea(canvas, gridWidth, gridHeight, gridOrigin);

    this.updateInterval = updateInterval;
    this._useAnimationFrameForUpdate = this.updateInterval === null;
    this.mainInterval = null;
    this.timestampLast = null;
    this.isPaused = true;
    this.isFF = false;
    this.minDelta = 0;
    this.maxDelta = 1000 / 24; // about 42 ms
    this.abandonFrameDeltaThreshold = this.maxDelta * 2;

    this.fastForwardFactor = fastForwardFactor;
    this.cancelFFOnPause = cancelFFOnPause;

    this.drawLoop = null;
    // The id of the next registered object
    this.idCounter = 0;
    /**
     * Layers holding all objects that receive update and draw calls
     * @type {LinkedList<GameObject>[]}
     */
    this.layers = [];
    this.currentlyChangingLayers = new Map();
    this.clearOnDraw = true;

    this.scheduledWorldScroll = {x: 0, y: 0};

    // Buttons
    this.playbutton = document.getElementById('playButton');
    this.ffbutton = document.getElementById('fastForwardButton');
    this.resetbutton = document.getElementById('resetButton');
    this.difficultySelect = document.getElementById('difficultySelect');
    this.muteButton = document.getElementById('muteButton');
    this.unmuteButton = document.getElementById('unmuteButton');

    if (this.playbutton) this.playbutton.onclick = this.togglePause.bind(this);
    if (this.ffbutton) {
      this.ffbutton.onclick = this.toggleFastForward.bind(this);
      this.ffbutton.disabled = this.isPaused;
    }
    if (this.difficultySelect)
      this.difficultySelect.onchange = this.onDifficultyChange.bind(this);

    // Soundtrack stuff.
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    /** @type {AudioContext} */
    this.audioContext = new AudioContext();
    this.audioContext.suspend();
    this.volume = 0.1;
    this.audioContextGain = new GainNode(this.audioContext, {
      gain: this.volume,
    });
    this.audioContextGain.connect(this.audioContext.destination);
    this.audioContextSource = null;
    this.audioContextSuspendingTimeout = null;
    // this.musicSpeedupOnFF = musicFF;
    this.muted = JSON.parse(
      window.localStorage.getItem(this.constructor.STORAGE_PREFIX + 'mute')
    );
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

    // Info field
    this.messageBox = document.getElementById('messageBox');

    this.constructor._instances.push(this);

    Resource.loadAssets(this.onAssetLoadUpdate.bind(this))
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

  startDrawLoop() {
    this.drawLoop = window.requestAnimationFrame(this.draw.bind(this));
  }
  stopDrawLoop() {
    window.cancelAnimationFrame(this.drawLoop);
    this.drawLoop = null;
  }

  onAssetLoadUpdate(progress, total) {
    this.setMessage(`Laddar (${progress}/${total}) ...`);
  }
  onAssetsLoaded() {}
  onAssetsLoadFailure(reason) {}

  onDifficultyChange(e) {}

  togglePause() {
    if (this.isPaused) this.onPlay();
    else this.onPause();
  }

  toggleFastForward() {
    if (this.isFF) {
      if (!this._useAnimationFrameForUpdate) {
        clearInterval(this.mainInterval);
        this.mainInterval = setInterval(
          () => this.update(),
          this.updateInterval
        );
      }
      this.isFF = false;
      this.offFastForward();
    } else {
      if (!this._useAnimationFrameForUpdate) {
        clearInterval(this.mainInterval);
        this.mainInterval = setInterval(
          () => this.update(),
          this.updateInterval / this._fastForwardFactor
        );
      }
      this.isFF = true;
      this.onFastForward();
    }
  }

  setMusic(source, loopStart = 0, loopEnd = null) {
    if (source instanceof Audio) {
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
        this.audioContextSource.start();
      });
    } else {
      throw new Error(
        `Invalid type of music source: ${source} (${source.constructor.name})`
      );
    }
    // if (this.isFF)
    //     this.currentMusic.playbackRate = Math.sqrt(this.fastForwardFactor);
  }

  onMusicPlay() {
    if (this.audioContextSuspendingTimeout !== null) {
      clearTimeout(this.audioContextSuspendingTimeout);
      this.audioContextSuspendingTimeout = null;
    }
    if (this.audioContext.state !== 'running') {
      this.audioContext.resume();
    }
    this.audioContextGain.gain.setValueAtTime(
      this.muted ? 0 : this.volume,
      this.audioContext.currentTime + 0.5
    );
  }
  onMusicPause() {
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
  setVolume(volume) {
    this.volume = volume;
    if (!this.muted) {
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
    this.muted = true;
    window.localStorage.setItem(
      this.constructor.STORAGE_PREFIX + 'mute',
      JSON.stringify(this.muted)
    );
  }
  onUnMute() {
    this.audioContextGain.gain.linearRampToValueAtTime(
      this.volume,
      this.audioContext.currentTime + 0.5
    );
    if (this.muteButton) this.muteButton.classList.remove('hidden');
    if (this.unmuteButton) this.unmuteButton.classList.add('hidden');
    this.muted = false;
    window.localStorage.setItem(
      this.constructor.STORAGE_PREFIX + 'mute',
      JSON.stringify(this.muted)
    );
  }

  onPlay() {
    this.isPaused = false;
    this.timestampLast = null;
    if (this._useAnimationFrameForUpdate)
      this.mainInterval = window.requestAnimationFrame(this.update.bind(this));
    else
      this.mainInterval = setInterval(
        () => this.update(),
        this.isFF
          ? this.updateInterval / this._fastForwardFactor
          : this.updateInterval
      );

    if (this.playbutton) {
      this.playbutton.children[0].classList.add('hidden');
      this.playbutton.children[1].classList.remove('hidden');
    }
    if (this.ffbutton) this.ffbutton.disabled = false;
  }

  onPause() {
    this.isPaused = true;
    if (this._useAnimationFrameForUpdate)
      window.cancelAnimationFrame(this.mainInterval);
    else clearInterval(this.mainInterval);
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

  setMessage(message, pureText = true) {
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
  update(timestamp) {
    if (!this._useAnimationFrameForUpdate) timestamp = new Date().getTime();

    // Skip first frame
    if (this.timestampLast === null) {
      if (this._useAnimationFrameForUpdate)
        this.mainInterval = window.requestAnimationFrame(
          this.update.bind(this)
        );
      this.timestampLast = timestamp;
      return;
    }

    let delta = timestamp - this.timestampLast;

    if (delta < this.minDelta) {
      if (this._useAnimationFrameForUpdate)
        this.mainInterval = window.requestAnimationFrame(
          this.update.bind(this)
        );
      return;
    }
    this.timestampLast = timestamp;

    // Prevent single frames with too large delta,
    // which otherwise cause collision detection / physics issues etc.
    if (delta > this.abandonFrameDeltaThreshold) {
      if (this._useAnimationFrameForUpdate)
        this.mainInterval = window.requestAnimationFrame(
          this.update.bind(this)
        );
      return;
    }
    delta = Math.min(this.maxDelta, delta);

    if (this._useAnimationFrameForUpdate && this.isFF)
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

    if (this._useAnimationFrameForUpdate)
      this.mainInterval = window.requestAnimationFrame(this.update.bind(this));
  }

  scrollWorld(x, y) {
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

  ensureLayerExists(layer) {
    if (layer < 0) throw new Error(`Layer cannot be negative, got: ${layer}`);

    if (layer >= this.layers.length) {
      this.layers = this.layers.concat(
        new Array(layer + 1 - this.layers.length)
          .fill(null)
          .map(() => new LinkedList())
      );
    }
  }

  // Register an object to receive update calls.
  // It should have an update method, a draw method accepting a GameArea, and
  // allow for setting an id
  registerObject(object, layer = 0) {
    this.ensureLayerExists(layer);
    this.layers[layer].push(object);
    object.id = this.idCounter++;
  }

  /**
   * Immediately changes the layer of an object. Prefer scheduleLayerChange()
   * during update calls,
   * or some objects may miss an update since the lists are modified while they
   * are being iterated over.
   * @param {GameObject} object
   * @param {number} source The layer that the object is currently in.
   * @param {number} destination The layer that the object should move to.
   */
  changeLayer(object, source, destination) {
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
  scheduleLayerChange(object, source, destination) {
    if (this.currentlyChangingLayers.has(object)) {
      source = this.currentlyChangingLayers.get(object).source;
    }
    this.currentlyChangingLayers.set(object, {
      source: source,
      destination: destination,
    });
  }

  // Make the object stop receiving update calls.
  unregisterObject(object) {
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
    return this.layers.reduce(
      (previous, current) => previous.concat(current.toArray()),
      /*initialValue=*/ []
    );
  }
}
