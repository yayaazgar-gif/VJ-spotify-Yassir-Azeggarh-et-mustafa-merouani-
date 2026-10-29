// Application Vue 3 : composants et démarrage
(function () {
  var root = document.getElementById('app');

  if (!window.Vue) {
    root.innerHTML = '<div class="fatal">Impossible de charger Vue.js (connexion internet nécessaire). Vérifie ta connexion puis recharge la page.</div>';
    return;
  }

  try {
    var Vue = window.Vue;
    var player = createPlayer(Vue.reactive, window.Audio, window.localStorage);
    var nav = Vue.reactive({ view: 'home', playlistId: '', query: '' });

    function go(view, playlistId) {
      nav.view = view;
      nav.playlistId = playlistId || '';
    }

    /* ---------- Composants ---------- */

    var TrackRow = {
      props: { track: { type: Object, required: true }, number: { type: Number, required: true } },
      emits: ['play'],
      setup: function (props) {
        var isCurrent = Vue.computed(function () {
          var c = player.current();
          return !!c && c.id === props.track.id;
        });
        var isPlaying = Vue.computed(function () { return isCurrent.value && player.state.playing; });
        return { player: player, isCurrent: isCurrent, isPlaying: isPlaying };
      },
      template: '' +
        '<div class="track-row" :class="{ current: isCurrent }" @dblclick="$emit(\'play\')">' +
          '<button class="num" @click="$emit(\'play\')" aria-label="Lire">' +
            '<span v-if="isPlaying" class="eq">&#9646;&#9646;&#9646;</span>' +
            '<span v-else class="n">{{ number }}</span>' +
            '<span class="hover-play">&#9654;</span>' +
          '</button>' +
          '<div class="t-main">' +
            '<div class="t-cover" :style="{ background: track.cover }"></div>' +
            '<div><div class="t-title">{{ track.title }}</div><div class="t-artist">{{ track.artist }}</div></div>' +
          '</div>' +
          '<div class="t-album">{{ track.album }}</div>' +
          '<button class="like" :class="{ on: player.isLiked(track.id) }" @click="player.toggleLike(track.id)" aria-label="Liker">' +
            '{{ player.isLiked(track.id) ? "♥" : "♡" }}' +
          '</button>' +
        '</div>'
    };

    var TrackList = {
      components: { TrackRow: TrackRow },
      props: { tracks: { type: Array, required: true } },
      setup: function () { return { player: player }; },
      template: '' +
        '<div class="track-list">' +
          '<div class="track-head"><span>#</span><span>Titre</span><span>Album</span><span></span></div>' +
          '<track-row v-for="(t, i) in tracks" :key="t.id" :track="t" :number="i + 1" @play="player.playQueue(tracks, i)"></track-row>' +
          '<p v-if="tracks.length === 0" class="empty">Aucun titre.</p>' +
        '</div>'
    };

    var SideBar = {
      setup: function () { return { nav: nav, go: go, playlists: PLAYLISTS }; },
      template: '' +
        '<aside class="sidebar">' +
          '<div class="card">' +
            '<div class="logo">&#9835; Spotify<span>Clone</span></div>' +
            '<button class="nav-link" :class="{ active: nav.view === \'home\' }" @click="go(\'home\')"><span class="ico">&#8962;</span> Accueil</button>' +
            '<button class="nav-link" :class="{ active: nav.view === \'search\' }" @click="go(\'search\')"><span class="ico">&#8981;</span> Rechercher</button>' +
          '</div>' +
          '<div class="card library">' +
            '<button class="nav-link" :class="{ active: nav.view === \'library\' }" @click="go(\'library\')"><span class="ico">&#9636;</span> Bibliothèque</button>' +
            '<ul>' +
              '<li v-for="p in playlists" :key="p.id">' +
                '<button class="pl-item" :class="{ active: nav.view === \'playlist\' && nav.playlistId === p.id }" @click="go(\'playlist\', p.id)">' +
                  '<div class="pl-cover" :style="{ background: p.cover }"></div>' +
                  '<div class="pl-info"><strong>{{ p.name }}</strong><small>Playlist · {{ p.tracks.length }} titres</small></div>' +
                '</button>' +
              '</li>' +
            '</ul>' +
          '</div>' +
        '</aside>'
    };

    var PlayerBar = {
      setup: function () {
        var s = player.state;
        var progress = Vue.computed(function () { return s.duration ? (s.currentTime / s.duration) * 100 : 0; });
        var volPct = Vue.computed(function () { return s.muted ? 0 : s.volume * 100; });
        var volIcon = Vue.computed(function () {
          if (s.muted || s.volume === 0) return '🔇';
          return s.volume < 0.5 ? '🔉' : '🔊';
        });
        function onSeek(e) { player.seek((Number(e.target.value) / 100) * s.duration); }
        function onVolume(e) { player.setVolume(Number(e.target.value) / 100); }
        return {
          player: player, s: s, progress: progress, volPct: volPct, volIcon: volIcon,
          onSeek: onSeek, onVolume: onVolume, formatTime: formatTime
        };
      },
      template: '' +
        '<footer class="player">' +
          '<div class="p-left">' +
            '<template v-if="player.current()">' +
              '<div class="p-cover" :style="{ background: player.current().cover }"></div>' +
              '<div class="p-meta"><div class="p-title">{{ player.current().title }}</div><div class="p-artist">{{ player.current().artist }}</div></div>' +
              '<button class="like" :class="{ on: player.isLiked(player.current().id) }" @click="player.toggleLike(player.current().id)" aria-label="Liker">' +
                '{{ player.isLiked(player.current().id) ? "♥" : "♡" }}' +
              '</button>' +
            '</template>' +
            '<div v-else class="p-empty">Choisis un titre à écouter</div>' +
          '</div>' +
          '<div class="p-center">' +
            '<div class="controls">' +
              '<button class="ctrl" :class="{ active: s.shuffle }" @click="player.toggleShuffle()" aria-label="Aléatoire">&#10542;</button>' +
              '<button class="ctrl" @click="player.prev()" aria-label="Précédent">&#9198;</button>' +
              '<button class="play-btn" @click="player.toggle()" aria-label="Lecture / Pause">{{ s.playing ? "❚❚" : "▶" }}</button>' +
              '<button class="ctrl" @click="player.next()" aria-label="Suivant">&#9197;</button>' +
              '<button class="ctrl" :class="{ active: s.repeat !== \'off\' }" @click="player.cycleRepeat()" aria-label="Répéter">{{ s.repeat === "one" ? "↻1" : "↻" }}</button>' +
            '</div>' +
            '<div class="seek">' +
              '<span>{{ formatTime(s.currentTime) }}</span>' +
              '<input type="range" min="0" max="100" step="0.1" :value="progress" :style="{ \'--v\': progress + \'%\' }" :disabled="!s.duration" @input="onSeek" aria-label="Progression" />' +
              '<span>{{ formatTime(s.duration) }}</span>' +
            '</div>' +
            '<div v-if="s.error" class="p-error">{{ s.error }}</div>' +
          '</div>' +
          '<div class="p-right">' +
            '<button class="ctrl" @click="player.toggleMute()" aria-label="Muet">{{ volIcon }}</button>' +
            '<input type="range" min="0" max="100" :value="volPct" :style="{ \'--v\': volPct + \'%\' }" @input="onVolume" aria-label="Volume" />' +
          '</div>' +
        '</footer>'
    };

    var HomeView = {
      setup: function () {
        var h = new Date().getHours();
        var greeting = h < 6 ? 'Bonne nuit' : h < 18 ? 'Bonjour' : 'Bonsoir';
        var popular = TRACKS.slice(0, 6);
        return { greeting: greeting, playlists: PLAYLISTS, popular: popular, player: player, go: go };
      },
      template: '' +
        '<section class="view">' +
          '<h1>{{ greeting }}</h1>' +
          '<div class="quick-grid">' +
            '<div v-for="p in playlists" :key="p.id" class="quick" style="cursor:pointer" @click="go(\'playlist\', p.id)">' +
              '<div class="q-cover" :style="{ background: p.cover }"></div>' +
              '<span>{{ p.name }}</span>' +
              '<button class="fab" @click.stop="player.playQueue(p.tracks, 0)" aria-label="Lire">&#9654;</button>' +
            '</div>' +
          '</div>' +
          '<h2>Tes playlists</h2>' +
          '<div class="cards">' +
            '<div v-for="p in playlists" :key="p.id" class="card-item" @click="go(\'playlist\', p.id)">' +
              '<div class="c-cover" :style="{ background: p.cover }">' +
                '<button class="fab" @click.stop="player.playQueue(p.tracks, 0)" aria-label="Lire">&#9654;</button>' +
              '</div>' +
              '<strong>{{ p.name }}</strong><small>{{ p.description }}</small>' +
            '</div>' +
          '</div>' +
          '<h2>Titres populaires</h2>' +
          '<div class="cards">' +
            '<div v-for="(t, i) in popular" :key="t.id" class="card-item" @click="player.playQueue(popular, i)">' +
              '<div class="c-cover" :style="{ background: t.cover }">' +
                '<button class="fab" aria-label="Lire">&#9654;</button>' +
              '</div>' +
              '<strong>{{ t.title }}</strong><small>{{ t.artist }}</small>' +
            '</div>' +
          '</div>' +
        '</section>'
    };

    var SearchView = {
      components: { TrackList: TrackList },
      setup: function () {
        var results = Vue.computed(function () {
          var q = nav.query.trim().toLowerCase();
          if (!q) return [];
          return TRACKS.filter(function (t) {
            return (t.title + ' ' + t.artist + ' ' + t.album).toLowerCase().indexOf(q) !== -1;
          });
        });
        return { nav: nav, results: results, genres: GENRES };
      },
      template: '' +
        '<section class="view">' +
          '<input v-model="nav.query" class="search" type="search" placeholder="Titre, artiste ou album…" />' +
          '<template v-if="nav.query.trim()">' +
            '<h2>Résultats ({{ results.length }})</h2>' +
            '<track-list :tracks="results"></track-list>' +
          '</template>' +
          '<template v-else>' +
            '<h2>Parcourir tout</h2>' +
            '<div class="genres"><div v-for="g in genres" :key="g.name" class="genre" :style="{ background: g.color }">{{ g.name }}</div></div>' +
          '</template>' +
        '</section>'
    };

    var PlaylistView = {
      components: { TrackList: TrackList },
      setup: function () {
        var playlist = Vue.computed(function () {
          return PLAYLISTS.filter(function (p) { return p.id === nav.playlistId; })[0] || null;
        });
        return { playlist: playlist, player: player, s: player.state, go: go };
      },
      template: '' +
        '<section class="view" v-if="playlist">' +
          '<header class="pl-header">' +
            '<div class="pl-big-cover" :style="{ background: playlist.cover }"></div>' +
            '<div><small>PLAYLIST</small><h1>{{ playlist.name }}</h1><p>{{ playlist.description }} · {{ playlist.tracks.length }} titres</p></div>' +
          '</header>' +
          '<div class="actions">' +
            '<button class="play-btn big" @click="player.playQueue(playlist.tracks, 0)" aria-label="Lire la playlist">&#9654;</button>' +
            '<button class="ctrl" :class="{ active: s.shuffle }" @click="player.toggleShuffle()" aria-label="Aléatoire">&#10542;</button>' +
          '</div>' +
          '<track-list :tracks="playlist.tracks"></track-list>' +
        '</section>' +
        '<section class="view" v-else><h1>Playlist introuvable</h1><button class="nav-link" @click="go(\'home\')">Retour à l\'accueil</button></section>'
    };

    var LibraryView = {
      components: { TrackList: TrackList },
      setup: function () {
        var liked = Vue.computed(function () {
          return TRACKS.filter(function (t) { return player.state.liked.indexOf(t.id) !== -1; });
        });
        return { liked: liked, player: player };
      },
      template: '' +
        '<section class="view">' +
          '<header class="pl-header">' +
            '<div class="pl-big-cover liked-cover">&#9829;</div>' +
            '<div><small>PLAYLIST</small><h1>Titres likés</h1><p>{{ liked.length }} titres</p></div>' +
          '</header>' +
          '<div class="actions" v-if="liked.length > 0">' +
            '<button class="play-btn big" @click="player.playQueue(liked, 0)" aria-label="Lire">&#9654;</button>' +
          '</div>' +
          '<track-list v-if="liked.length > 0" :tracks="liked"></track-list>' +
          '<p v-else class="empty">Clique sur &#9825; à côté d\'un titre pour le retrouver ici.</p>' +
        '</section>'
    };

    var App = {
      components: {
        SideBar: SideBar, PlayerBar: PlayerBar, HomeView: HomeView,
        SearchView: SearchView, LibraryView: LibraryView, PlaylistView: PlaylistView
      },
      setup: function () { return { nav: nav }; },
      template: '' +
        '<div class="layout">' +
          '<side-bar></side-bar>' +
          '<main class="main">' +
            '<home-view v-if="nav.view === \'home\'"></home-view>' +
            '<search-view v-else-if="nav.view === \'search\'"></search-view>' +
            '<library-view v-else-if="nav.view === \'library\'"></library-view>' +
            '<playlist-view v-else-if="nav.view === \'playlist\'"></playlist-view>' +
          '</main>' +
          '<player-bar></player-bar>' +
        '</div>'
    };

    Vue.createApp(App).mount('#app');

    // Barre d'espace = lecture / pause (sauf pendant la saisie)
    document.addEventListener('keydown', function (e) {
      var tag = e.target && e.target.tagName;
      if (e.code === 'Space' && tag !== 'INPUT' && tag !== 'BUTTON' && tag !== 'TEXTAREA') {
        e.preventDefault();
        player.toggle();
      }
    });
  } catch (err) {
    root.innerHTML = '<div class="fatal">Erreur au démarrage : ' + String(err && err.message ? err.message : err) + '</div>';
    if (window.console) console.error(err);
  }
})();
