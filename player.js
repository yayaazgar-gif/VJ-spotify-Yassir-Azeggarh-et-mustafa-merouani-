// Données (titres, playlists) et logique du lecteur audio
var SONG_BASE = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-';

var PALETTE = [
  ['#1db954', '#0b3d2e'], ['#e91e63', '#4a0f26'], ['#ff9800', '#4d2a00'], ['#3f51b5', '#10163f'],
  ['#9c27b0', '#2f0d38'], ['#00bcd4', '#06333a'], ['#f44336', '#430f0b'], ['#8bc34a', '#243311']
];

var TITLES = [
  ['Aurore Digitale', 'Neon Atlas', 'Horizons'],
  ['Nuit Blanche', 'Velours', 'Minuit'],
  ['Sable Doré', 'Dune Club', 'Mirage'],
  ['Cœur de Verre', 'Lumen', 'Prisme'],
  ['Onde Courte', 'Satellite Sud', 'Fréquence'],
  ['Brume du Matin', 'Lac Bleu', 'Reflets'],
  ['Pulsation', 'Rouge Vif', 'Tempo'],
  ['Feuilles', 'Mousse', 'Sous-bois'],
  ['Marée Haute', 'Cap Nord', 'Vagues'],
  ['Étoile Filante', 'Orion', 'Cosmos'],
  ['Atlas Express', 'Rif', 'Voyage'],
  ['Bleu Nuit', 'Opale', 'Songe'],
  ['Tangente', 'Axiome', 'Delta'],
  ['Souk Électrique', 'Marrakech Beat', 'Médina'],
  ['Lueur', 'Aube', 'Silence'],
  ['Ressac', 'Ancre', 'Écume']
];

var TRACKS = TITLES.map(function (t, i) {
  var c = PALETTE[i % PALETTE.length];
  return {
    id: i + 1,
    title: t[0],
    artist: t[1],
    album: t[2],
    cover: 'linear-gradient(135deg, ' + c[0] + ', ' + c[1] + ')',
    src: SONG_BASE + (i + 1) + '.mp3'
  };
});

function pickTracks(ids) {
  return ids.map(function (id) {
    return TRACKS.filter(function (t) { return t.id === id; })[0];
  });
}

var PLAYLISTS = [
  { id: 'chill', name: 'Chill du soir', description: 'Pour se détendre après la journée',
    cover: 'linear-gradient(135deg, #3f51b5, #00bcd4)', tracks: pickTracks([2, 6, 8, 12, 15, 16]) },
  { id: 'energie', name: 'Énergie', description: 'Boost pour le sport et le travail',
    cover: 'linear-gradient(135deg, #f44336, #ff9800)', tracks: pickTracks([3, 7, 11, 13, 14, 1]) },
  { id: 'focus', name: 'Focus', description: 'Concentration maximale',
    cover: 'linear-gradient(135deg, #1db954, #243311)', tracks: pickTracks([4, 5, 9, 10, 12, 15]) },
  { id: 'decouvertes', name: 'Découvertes', description: 'Tous les titres du catalogue',
    cover: 'linear-gradient(135deg, #9c27b0, #e91e63)', tracks: TRACKS.slice() }
];

var GENRES = [
  { name: 'Pop', color: '#e91e63' }, { name: 'Électro', color: '#3f51b5' },
  { name: 'Chill', color: '#00897b' }, { name: 'Rock', color: '#d84315' },
  { name: 'Jazz', color: '#6a1b9a' }, { name: 'Classique', color: '#5d4037' },
  { name: 'Hip-hop', color: '#f9a825' }, { name: 'Podcasts', color: '#2e7d32' }
];

function formatTime(s) {
  if (!isFinite(s) || s < 0) return '0:00';
  var m = Math.floor(s / 60);
  var sec = Math.floor(s % 60);
  return m + ':' + (sec < 10 ? '0' : '') + sec;
}

function safeGet(storage, key, fallback) {
  try {
    var v = storage.getItem(key);
    return v === null || v === undefined ? fallback : JSON.parse(v);
  } catch (e) {
    return fallback;
  }
}

function safeSet(storage, key, value) {
  try { storage.setItem(key, JSON.stringify(value)); } catch (e) { /* stockage indisponible */ }
}

/**
 * Crée le lecteur audio.
 * reactive : fonction de réactivité (Vue.reactive) ; AudioCtor : constructeur Audio ; storage : localStorage.
 */
function createPlayer(reactive, AudioCtor, storage) {
  var audio = new AudioCtor();
  audio.preload = 'metadata';

  var vol = Number(safeGet(storage, 'sc_volume', 0.7));
  if (!isFinite(vol) || vol < 0 || vol > 1) vol = 0.7;
  var likedInit = safeGet(storage, 'sc_liked', []);
  if (!Array.isArray(likedInit)) likedInit = [];

  var state = reactive({
    queue: TRACKS.slice(),
    index: -1,
    playing: false,
    currentTime: 0,
    duration: 0,
    volume: vol,
    muted: false,
    shuffle: false,
    repeat: 'off',
    error: '',
    liked: likedInit
  });

  audio.volume = state.volume;

  function current() {
    return state.queue[state.index] || null;
  }

  function startPlayback() {
    var p = audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function () { state.playing = false; });
    }
  }

  function loadTrack(i) {
    var n = state.queue.length;
    if (!n) return;
    state.index = ((i % n) + n) % n;
    state.error = '';
    state.currentTime = 0;
    state.duration = 0;
    audio.src = state.queue[state.index].src;
    startPlayback();
  }

  function playQueue(list, startIndex) {
    state.queue = list.slice();
    loadTrack(startIndex || 0);
  }

  function toggle() {
    if (!current()) { loadTrack(0); return; }
    if (audio.paused) startPlayback();
    else audio.pause();
  }

  function next(auto) {
    var n = state.queue.length;
    if (!n) return;
    if (auto && state.repeat === 'one') {
      audio.currentTime = 0;
      startPlayback();
      return;
    }
    if (state.shuffle && n > 1) {
      var r;
      do { r = Math.floor(Math.random() * n); } while (r === state.index);
      loadTrack(r);
      return;
    }
    if (auto && state.repeat === 'off' && state.index >= n - 1) {
      audio.pause();
      audio.currentTime = 0;
      state.playing = false;
      return;
    }
    loadTrack(state.index + 1);
  }

  function prev() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    loadTrack(state.index - 1);
  }

  function seek(t) {
    if (!state.duration) return;
    audio.currentTime = t;
    state.currentTime = t;
  }

  function setVolume(v) {
    state.volume = v;
    state.muted = false;
    audio.muted = false;
    audio.volume = v;
    safeSet(storage, 'sc_volume', v);
  }

  function toggleMute() {
    state.muted = !state.muted;
    audio.muted = state.muted;
  }

  function toggleShuffle() { state.shuffle = !state.shuffle; }

  function cycleRepeat() {
    state.repeat = state.repeat === 'off' ? 'all' : state.repeat === 'all' ? 'one' : 'off';
  }

  function isLiked(id) { return state.liked.indexOf(id) !== -1; }

  function toggleLike(id) {
    state.liked = isLiked(id)
      ? state.liked.filter(function (x) { return x !== id; })
      : state.liked.concat([id]);
    safeSet(storage, 'sc_liked', state.liked.slice());
  }

  audio.addEventListener('timeupdate', function () { state.currentTime = audio.currentTime || 0; });
  audio.addEventListener('loadedmetadata', function () { state.duration = isFinite(audio.duration) ? audio.duration : 0; });
  audio.addEventListener('durationchange', function () { state.duration = isFinite(audio.duration) ? audio.duration : 0; });
  audio.addEventListener('ended', function () { next(true); });
  audio.addEventListener('play', function () { state.playing = true; });
  audio.addEventListener('pause', function () { state.playing = false; });
  audio.addEventListener('error', function () {
    state.error = 'Impossible de lire ce titre (vérifie ta connexion internet).';
    state.playing = false;
  });

  return {
    state: state,
    current: current,
    playQueue: playQueue,
    toggle: toggle,
    next: next,
    prev: prev,
    seek: seek,
    setVolume: setVolume,
    toggleMute: toggleMute,
    toggleShuffle: toggleShuffle,
    cycleRepeat: cycleRepeat,
    isLiked: isLiked,
    toggleLike: toggleLike
  };
}
