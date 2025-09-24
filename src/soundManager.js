import * as THREE from 'three';

class SoundManager {
  constructor() {
    this.audioListener = new THREE.AudioListener();
  }

  async loadSounds() {
    const [song, gunfire, running] = await Promise.all([
      this.loadSound('./resources/song-cropped.mp3'),
      this.loadSound('./resources/gunfire.mp3'),
      this.loadSound('./resources/running.mp3'),
    ]);

    this.song = song;
    this.song.setVolume(1);
    this.song.setLoop(true);
    this.gunfire = gunfire;
    this.gunfire.setVolume(1);
    this.running = running;
    this.running.setLoop(true);
    this.running.setVolume(0.7);
    return Promise.resolve();
  }

  loadSound(url) {
    return new Promise((resolve) => {
      const sound = new THREE.Audio(this.audioListener);
      const loader = new THREE.AudioLoader();
      loader.load(url, (audioBuffer) => {
        sound.setBuffer(audioBuffer);
        resolve(sound);
      });
    });
  }
}

const soundManager = new SoundManager();
export { soundManager };
