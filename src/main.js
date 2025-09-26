import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer';
import * as YUKA from 'yuka';
import { clone } from 'three/examples/jsm/utils/SkeletonUtils';
// import { initializeApp } from 'firebase/app';
import { Player } from './player';
import { Doll } from './doll';
import { NpcPlayer } from './npcPlayer';
import { Soldier } from './soldier';
import { ThirdPersonControls } from './thirdPersonControls';
import { FinishLineTrigger } from './finishLineTrigger';
import { DOLL_STATES, PLAYER_STATES } from './states';
import { getRandomArbitrary, getRandomInt } from './utils';
import { getRandomBehavior } from './behaviors';
import { soundManager } from './soundManager';

// import { firebaseConfig } from '../firebaseConfig';

// const app = initializeApp(firebaseConfig);

const ANIMATION_DEAD_ARRAY = 'dead_array';

class SquidGame {
  constructor(props) {
    this.init(props);
  }

  init(props) {
    const { mode } = props || {};
    this.mode = mode;
    THREE.Cache.enabled = true;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.aspect = window.innerWidth / window.innerHeight;

    // // Setup CSS2D renderer for HTML labels in 3D space
    // this.labelRenderer = new CSS2DRenderer();
    // this.labelRenderer.setSize(window.innerWidth, window.innerHeight);
    // this.labelRenderer.domElement.style.position = 'absolute';
    // this.labelRenderer.domElement.style.top = '0px';

    const container = document.createElement('div');
    container.appendChild(this.renderer.domElement);
    // container.appendChild(this.labelRenderer.domElement);
    document.body.appendChild(container);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('white');

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      200,
    );
    this.camera.position.set(0, 3, 15);
    this.camera.lookAt(this.scene.position);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444);
    hemiLight.position.set(0, 100, 0);
    hemiLight.matrixAutoUpdate = false;
    hemiLight.updateMatrix();
    this.scene.add(hemiLight);

    const light = new THREE.DirectionalLight(0xffffff, 1.0);
    light.position.set(50, 20, 50);
    light.matrixAutoUpdate = false;
    light.updateMatrix();
    light.castShadow = true;
    light.shadow.bias = -0.001;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 1000.0;
    light.shadow.camera.left = 100;
    light.shadow.camera.right = -100;
    light.shadow.camera.top = 100;
    light.shadow.camera.bottom = -100;
    this.scene.add(light);

    const groundGeometry = new THREE.PlaneGeometry(30, 150);
    const groundTexture = new THREE.TextureLoader().load(
      './resources/ground.jpg',
    );
    const groundMaterial = new THREE.MeshLambertMaterial({
      map: groundTexture,
    });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.matrixAutoUpdate = false;
    groundMesh.receiveShadow = true;
    groundMesh.updateMatrix();
    this.scene.add(groundMesh);

    this.entityManager = new YUKA.EntityManager();
    this.time = new YUKA.Time();

    this.loadModels();
    this.addTriggers();

    const startButton = document.getElementById('start');
    startButton.addEventListener(
      'click',
      () => {
        const intro = document.getElementById('intro');
        const textMode = document.getElementById('select-mode').value
        this.mode = textMode;
        intro.classList.add('hidden');
        this.startGame();
      },
      false,
    );
  }

  startGame() {
    this.controls.connect(this.renderer);
    this.startTimer();
    this.entityManager.entities
      .filter((entity) => entity instanceof NpcPlayer)
      .forEach((entity) => {
        entity.behavior.activate();
      });
  }

  startTimer() {
    let timer = 54;
    let minutes;
    let seconds;
    if (this.mode !== 'hard') {
      timer = 59
      soundManager.song.play();
    }
    this.doll.stateMachine.changeTo(DOLL_STATES.GREEN_LIGHT);
    document.getElementById("text-mode").textContent = "MODE :" + this.mode.toUpperCase();

    const interval = setInterval(() => {
      minutes = parseInt(timer / 60, 10);
      seconds = parseInt(timer % 60, 10);

      minutes = minutes < 10 ? `0${minutes}` : minutes;
      seconds = seconds < 10 ? `0${seconds}` : seconds;

      document.getElementById('countdowntimer').textContent = `${minutes}:${seconds}`;

      this.doll.timer = timer;
      if (--timer < 0) {
        if (this.mode !== 'hard') {
          soundManager.song.stop();
        }
        this.doll.stateMachine.changeTo(DOLL_STATES.ELIMINATE_ALL);
        clearInterval(interval);
        this.onGameEnd();
      }
    }, 1000);
  }

  onGameEnd = () => {
    const intro = document.getElementById('intro');
    document.getElementById('start').style.visibility = 'hidden';
    document.getElementById("select-mode").hidden = true;
    const resultText = document.getElementById("result");
    resultText.style.visibility = 'visible'
    soundManager.running.stop();
    const { currentState } = this.player.stateMachine;
    const currentStateId = currentState.id;
    if (currentStateId === PLAYER_STATES.DEAD) {
      resultText.innerText = 'You Lose';
    } else {
      resultText.innerText = 'You Win';
    }
    intro.classList.remove('hidden');
  };

  addTriggers() {
    const size = new YUKA.Vector3(50, 5, 10);
    const rectangularTriggerRegion = new YUKA.RectangularTriggerRegion(size);
    const finishLineTrigger = new FinishLineTrigger(rectangularTriggerRegion);
    finishLineTrigger.position.set(0, 0, -50);
    this.entityManager.add(finishLineTrigger);
  }

  async loadModels() {
    await this.addPlayer();
    await Promise.all([
      this.addWalls(),
      this.addTree(),
      this.addSoldier(3, 0, -50),
      this.addSoldier(-3, 0, -50),
      this.addDoll(),
      this.addNpcPlayers(),
      soundManager.loadSounds(),
    ]);

    // Create player name label after all NPCs are created to avoid cloning issues
    this.createPlayerNameLabel();

    this.onFinishedLoading();
  }

  async addDoll() {
    const { renderComponent, mixer, animations } = await this.loadDollModel();
    this.doll = new Doll(mixer, animations);
    this.doll.setRenderComponent(renderComponent, this.sync);
    this.doll.position.set(0, 0, -52);
    this.doll.lookAt(new YUKA.Vector3(0, 0, -100));
    this.doll.scale.set(3, 3, 3);
    this.entityManager.add(this.doll);
  }

  loadDollModel() {
    return new Promise((resolve) => {
      let renderComponent;
      let mixer;
      let animations;
      const loader = new FBXLoader();
      loader.setPath('./resources/models/doll/');
      loader.load('doll.fbx', (fbx) => {
        fbx.matrixAutoUpdate = false;
        const texture = new THREE.TextureLoader().load(
          './resources/models/doll/MaterialColor.png',
        );
        const material = new THREE.MeshBasicMaterial({ map: texture });
        fbx.traverse((child) => {
          if (child.isMesh) {
            child.material = material;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        renderComponent = fbx;
        this.scene.add(fbx);

        mixer = new THREE.AnimationMixer(fbx);
        animations = new Map();
        resolve({ mixer, animations, renderComponent });
      });
    });
  }

  async addNpcPlayers() {
    const promises = [];
    for (let i = 0; i < 50; i++) {
      promises.push(this.addNpcPlayer());
    }
    return Promise.all(promises);
  }

  async addNpcPlayer() {
    const renderComponent = clone(this.player._renderComponent);
    const mixer = new THREE.AnimationMixer(renderComponent);
    this.scene.add(renderComponent);
    const newAnimations = new Map();
    this.animationClips.forEach((clip, state) => {
      if (state !== PLAYER_STATES.DEAD) {
        let c = clip;
        let s = state;
        if (Array.isArray(clip)) {
          c = c[getRandomInt(0, 3)];
          s = PLAYER_STATES.DEAD;
        }
        const newClip = c.clone();
        const action = mixer.clipAction(newClip);
        action.play();
        action.enabled = false;
        newAnimations.set(s, action);
      }
    });
    const npcPlayer = new NpcPlayer(mixer, newAnimations);
    npcPlayer.setRenderComponent(renderComponent, this.sync);
    npcPlayer.position.set(getRandomInt(-14, 14), 0, getRandomInt(47, 50));
    const behavior = getRandomBehavior(npcPlayer);
    behavior.active = false;
    npcPlayer.addBehavior(behavior);
    npcPlayer.maxSpeed = getRandomArbitrary(3, 6);
    this.entityManager.add(npcPlayer);
    return Promise.resolve();
  }

  async addSoldier(x, y, z) {
    const { renderComponent, mixer, animations } = await this.loadSoldierModel();
    const soldier = new Soldier(mixer, animations);

    soldier.setRenderComponent(renderComponent, this.sync);
    soldier.position.set(x, y, z);

    this.entityManager.add(soldier);
  }

  async loadSoldierModel() {
    return new Promise((resolve) => {
      let renderComponent;
      let mixer;
      let animations;
      const loader = new FBXLoader();
      loader.setPath('./resources/models/soldier/');
      loader.load('Idle.fbx', (fbx) => {
        fbx.matrixAutoUpdate = false;
        const texture = new THREE.TextureLoader().load(
          './resources/models/soldier/Diff_Color.png',
        );
        const material = new THREE.MeshBasicMaterial({ map: texture });
        fbx.traverse((child) => {
          if (child.isMesh) {
            child.material = material;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        renderComponent = fbx;
        this.scene.add(fbx);
        const loadingManager = new THREE.LoadingManager(() => {
          resolve({ renderComponent, mixer, animations });
        });

        mixer = new THREE.AnimationMixer(fbx);
        animations = new Map();

        const onLoad = (state, animation) => {
          const clip = animation.animations[0];
          const action = mixer.clipAction(clip);
          action.play();
          action.enabled = false;
          animations.set(state, action);
          resolve({ renderComponent, mixer, animations });
        };
        const animationLoader = new FBXLoader(loadingManager);
        animationLoader.setPath('./resources/models/soldier/');
        animationLoader.load('Idle.fbx', (animation) => {
          onLoad(PLAYER_STATES.IDLE, animation);
        });
      });
    });
  }

  async addPlayer() {
    const {
      renderComponent, mixer, animations,
    } = await this.loadPlayerModel();
    animations.set(
      PLAYER_STATES.DEAD,
      animations.get(ANIMATION_DEAD_ARRAY)[getRandomInt(0, 3)],
    );
    animations.delete(ANIMATION_DEAD_ARRAY);
    this.player = new Player(mixer, animations, this.onGameEnd, "Bạn đây nè, Chúc may mắn");
    this.player.setRenderComponent(renderComponent, this.sync);
    this.player.position.set(0, 0, 50);
    this.entityManager.add(this.player);
    this.initControls();

    // Don't create the name label here - we'll create it after NPCs are added
  }

  createPlayerNameLabel() {
    const playerNameDiv = document.createElement('div');
    playerNameDiv.className = 'player-name-label';
    playerNameDiv.textContent = this.player.name;
    playerNameDiv.style.color = 'white';
    playerNameDiv.style.fontFamily = 'Lato, Arial, sans-serif';
    playerNameDiv.style.fontSize = '16px';
    playerNameDiv.style.fontWeight = 'bold';
    playerNameDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    playerNameDiv.style.padding = '4px 8px';
    playerNameDiv.style.borderRadius = '4px';
    playerNameDiv.style.textAlign = 'center';
    playerNameDiv.style.pointerEvents = 'none';

    const playerNameLabel = new CSS2DObject(playerNameDiv);
    playerNameLabel.position.set(0, 2.5, 0); // Position above player's head

    // Add the label to the player's render component
    this.player._renderComponent.add(playerNameLabel);
    this.playerNameLabel = playerNameLabel;
  }

  loadPlayerModel() {
    this.animationClips = new Map();

    return new Promise((resolve) => {
      let renderComponent;
      let mixer;
      let animations;
      let animationClips;
      const loadingManager = new THREE.LoadingManager(() => resolve({
        mixer,
        animations,
        renderComponent,
        animationClips,
      }));
      const loader = new FBXLoader();
      loader.setPath('./resources/models/player/');
      loader.load('Idle.fbx', (fbx) => {
        fbx.matrixAutoUpdate = false;
        const texture = new THREE.TextureLoader().load(
          './resources/models/player/MaterialColor.png',
        );
        const material = new THREE.MeshBasicMaterial({ map: texture });
        fbx.traverse((child) => {
          if (child.isMesh) {
            child.material = material;
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        renderComponent = fbx;
        this.scene.add(fbx);

        mixer = new THREE.AnimationMixer(fbx);
        animations = new Map();
        const onLoad = (state, animation, array = false) => {
          const clip = animation.animations[0];
          const action = mixer.clipAction(clip);
          action.play();
          action.enabled = false;
          if (array) {
            const stateClips = this.animationClips.get(state) || [];
            this.animationClips.set(state, [...stateClips, clip]);

            const stateAnimations = animations.get(state) || [];
            animations.set(state, [...stateAnimations, action]);
          } else {
            this.animationClips.set(state, clip);
            animations.set(state, action);
          }
        };

        const animLoader = new FBXLoader(loadingManager);
        animLoader.setPath('./resources/models/player/');
        animLoader.load('Idle.fbx', (animation) => {
          onLoad(PLAYER_STATES.IDLE, animation);
        });
        animLoader.load('Walk.fbx', (animation) => {
          onLoad(PLAYER_STATES.WALK, animation);
        });
        animLoader.load('Running.fbx', (animation) => {
          onLoad(PLAYER_STATES.RUN, animation);
        });
        animLoader.load('Hit.fbx', (animation) => {
          onLoad(ANIMATION_DEAD_ARRAY, animation, true);
        });
        animLoader.load('Fall_Flat.fbx', (animation) => {
          onLoad(ANIMATION_DEAD_ARRAY, animation, true);
        });
        animLoader.load('Standing_Death_Left_01.fbx', (animation) => {
          onLoad(ANIMATION_DEAD_ARRAY, animation, true);
        });
        animLoader.load('Standing_Death_Right_01.fbx', (animation) => {
          onLoad(ANIMATION_DEAD_ARRAY, animation, true);
        });
        animLoader.load('Dance.fbx', (animation) => {
          onLoad(PLAYER_STATES.DANCE, animation);
        });
      });
    });
  }

  initControls() {
    this.controls = new ThirdPersonControls(this.player, this.camera);
  }

  addWalls() {
    const frontWallTexture = new THREE.TextureLoader().load(
      './resources/front-wall.jpg',
    );
    const frontWallMaterial = new THREE.MeshLambertMaterial({
      map: frontWallTexture,
    });
    const sideWallsTexture = new THREE.TextureLoader().load(
      './resources/wall.jpg',
    );
    const sideWallsMaterial = new THREE.MeshLambertMaterial({
      map: sideWallsTexture,
    });

    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(30, 10, 2),
      frontWallMaterial,
    );
    this.scene.add(frontWall);
    frontWall.position.y += 5;
    frontWall.position.z = -67;

    const leftWall = new THREE.Mesh(
      new THREE.BoxGeometry(150, 10, 2),
      sideWallsMaterial,
    );
    this.scene.add(leftWall);
    leftWall.position.x = -16;
    leftWall.position.y += 5;
    leftWall.rotateY(Math.PI / 2);

    const rightWall = new THREE.Mesh(
      new THREE.BoxGeometry(150, 10, 2),
      sideWallsMaterial,
    );
    this.scene.add(rightWall);
    rightWall.position.x = +16;
    rightWall.position.y += 5;
    rightWall.rotateY(Math.PI / 2);

    const material = new THREE.LineBasicMaterial({
      color: 'red',
      linewidth: 10,
    });
    const points = [];
    points.push(new THREE.Vector3(-20, 0, -44));
    points.push(new THREE.Vector3(0, 0, -44));
    points.push(new THREE.Vector3(20, 0, -44));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    return Promise.resolve();
  }

  addTree() {
    return new Promise((resolve) => {
      const loader = new FBXLoader();
      loader.setPath('./resources/models/');
      loader.load('dead-tree.fbx', (fbx) => {
        fbx.scale.setScalar(0.009);
        fbx.position.set(0, 0, -60);
        fbx.traverse((child) => {
          child.castShadow = false;
          child.receiveShadow = false;
        });
        this.scene.add(fbx);
        resolve();
      });
    });
  }

  onFinishedLoading() {
    const loadingScreen = document.getElementById('loading-screen');
    loadingScreen.classList.add('fade-out');
    loadingScreen.addEventListener('transitionend', this.onTransitionEnd);
    this.animate();
  }

  onTransitionEnd(event) {
    event.target.remove();
  }

  sync(entity, renderComponent) {
    renderComponent.matrix.copy(entity.worldMatrix);
  }

  animate() {
    requestAnimationFrame(() => {
      this.animate();
      this.handleResize();
      const delta = this.time.update().getDelta();
      this.controls.update(delta);
      this.entityManager.update(delta);
      this.renderer.render(this.scene, this.camera);
    });
  }

  handleResize() {
    const newAspect = window.innerWidth / window.innerHeight;
    if (this.aspect !== newAspect) {
      this.aspect = newAspect;
      this.camera.aspect = newAspect;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }
}

// eslint-disable-next-line no-unused-vars
let APP = null;

window.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(
      new URL('../static/resources/service-worker.js', import.meta.url),
      { type: 'module' },
    );
  }
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode');
  APP = new SquidGame({
    mode,
  });
});
