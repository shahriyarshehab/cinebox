/**
 * CineBox Dedicated Web Audio DSP & Multi-Audio Track Engine
 * Provides:
 *  - Master Volume Booster up to 300% via Web Audio GainNode
 *  - Dynamic Compression & Dialogue Enhancer Profiles (Bass, Dialogue, Night Mode)
 *  - Dual-Audio Stereo Channel Splitter (Left Channel = Dub 1, Right Channel = Dub 2)
 *  - Native HTML5 & Hls.js Audio Track Switching
 *  - Synchronized External Audio Player (.mp3, .aac)
 */

let audioCtx = null;
let audioSourceNode = null;
let audioGainNode = null;
let audioFilterNode = null;
let audioCompressorNode = null;
let channelSplitterNode = null;
let channelMergerNode = null;
let isAudioEngineInitialized = false;
let externalAudioPlayer = null;

// ==========================================================================
//  Audio Booster, Equalizer & Web Audio API Engine
// ==========================================================================
function setupAudioBooster() {
  const player = document.getElementById('videoPlayer');
  if (!player || isAudioEngineInitialized) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    audioCtx = new AudioContextClass();
    audioSourceNode = audioCtx.createMediaElementSource(player);
    channelSplitterNode = audioCtx.createChannelSplitter(2);
    channelMergerNode = audioCtx.createChannelMerger(2);
    audioFilterNode = audioCtx.createBiquadFilter();
    audioCompressorNode = audioCtx.createDynamicsCompressor();
    audioGainNode = audioCtx.createGain();

    // Connect chain: source -> splitter -> [routing] -> merger -> filter -> compressor -> gain -> destination
    audioSourceNode.connect(channelSplitterNode);
    applyAudioChannelRouting();

    channelMergerNode.connect(audioFilterNode);
    audioFilterNode.connect(audioCompressorNode);
    audioCompressorNode.connect(audioGainNode);
    audioGainNode.connect(audioCtx.destination);

    isAudioEngineInitialized = true;
    applyAudioSettings();
  } catch (e) {
    console.warn('Audio Context initialization fallback', e);
  }
}

function applyAudioChannelRouting() {
  if (!channelSplitterNode || !channelMergerNode) return;

  try {
    channelSplitterNode.disconnect();
  } catch (e) {}

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  const settings = window.playerSettings || {};
  const mode = settings.stereoChannelMode || settings.audioTrackMode || 'stereo';

  if (mode === 'left-channel') {
    // Route Left input channel (0) to both Left (0) and Right (1) outputs (Dual Audio Dub 1 / Hindi)
    channelSplitterNode.connect(channelMergerNode, 0, 0);
    channelSplitterNode.connect(channelMergerNode, 0, 1);
  } else if (mode === 'right-channel') {
    // Route Right input channel (1) to both Left (0) and Right (1) outputs (Dual Audio Dub 2 / English)
    channelSplitterNode.connect(channelMergerNode, 1, 0);
    channelSplitterNode.connect(channelMergerNode, 1, 1);
  } else {
    // Standard Stereo (0->0, 1->1)
    channelSplitterNode.connect(channelMergerNode, 0, 0);
    channelSplitterNode.connect(channelMergerNode, 1, 1);
  }
}

function selectStereoChannelMode(mode) {
  if (window.playerSettings) {
    window.playerSettings.stereoChannelMode = mode;
  }
  if (typeof savePlayerSettings === 'function') savePlayerSettings();
  setupAudioBooster();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  applyAudioChannelRouting();
  if (typeof updateCustomizerUIState === 'function') updateCustomizerUIState();
  if (typeof updateYouTubeMenuState === 'function') updateYouTubeMenuState();
  const label =
    mode === 'left-channel'
      ? 'Left Channel (Dub 1)'
      : mode === 'right-channel'
        ? 'Right Channel (Dub 2)'
        : 'Stereo (Master)';
  if (typeof showToast === 'function') showToast(`Stereo Mode: ${label}`);
}

function selectAudioTrackMode(mode, title, nativeTrackIdx = -1, hlsTrackIdx = -1) {
  const player = document.getElementById('videoPlayer');
  if (!player) return;

  const settings = window.playerSettings || {};
  settings.audioTrackMode = mode;
  settings.audioTrackTitle = title || 'Default Audio';

  if (mode === 'disable') {
    player.muted = true;
    if (externalAudioPlayer) {
      externalAudioPlayer.pause();
    }
  } else if (hlsTrackIdx >= 0 && window.hlsPlayerInstance && window.hlsPlayerInstance.audioTracks && window.hlsPlayerInstance.audioTracks.length > 0) {
    window.hlsPlayerInstance.audioTrack = hlsTrackIdx;
    player.muted = false;
    if (externalAudioPlayer) {
      externalAudioPlayer.pause();
      externalAudioPlayer = null;
    }
  } else if (nativeTrackIdx >= 0 && player.audioTracks && player.audioTracks.length > 0) {
    for (let i = 0; i < player.audioTracks.length; i++) {
      player.audioTracks[i].enabled = i === nativeTrackIdx;
    }
    player.muted = false;
    if (externalAudioPlayer) {
      externalAudioPlayer.pause();
      externalAudioPlayer = null;
    }
  } else if (mode === 'external') {
    // Handled in loadExternalAudio
  } else {
    // Standard stereo or dual-channel mode
    if (externalAudioPlayer) {
      externalAudioPlayer.pause();
      externalAudioPlayer = null;
    }
    player.muted = false;
    settings.stereoChannelMode = mode;
    setupAudioBooster();
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    applyAudioChannelRouting();
  }

  if (typeof savePlayerSettings === 'function') savePlayerSettings();
  if (typeof updateCustomizerUIState === 'function') updateCustomizerUIState();
  if (typeof updateYouTubeMenuState === 'function') updateYouTubeMenuState();
  detectAndRenderAudioTracks();
  if (typeof showToast === 'function') showToast(`Audio Track: ${settings.audioTrackTitle}`);
}

// ==========================================================================
//  Multi-Language Audio Track Detection Engine
// ==========================================================================
const CINEBOX_AUDIO_LANGUAGES = [
  { key: 'hindi', label: 'Hindi', flag: '', nativeName: 'हिन्दी', regex: /\b(hindi|hin|হিন্দি)\b/i },
  { key: 'english', label: 'English', flag: '', nativeName: 'English', regex: /\b(english|eng|ইংরেজি)\b/i },
  { key: 'bangla', label: 'Bangla', flag: '', nativeName: 'বাংলা', regex: /\b(bangla|bengali|ben|বাংলা)\b/i },
  { key: 'tamil', label: 'Tamil', flag: '', nativeName: 'தமிழ்', regex: /\b(tamil|tam|தமிழ்)\b/i },
  { key: 'telugu', label: 'Telugu', flag: '', nativeName: 'తెలుగు', regex: /\b(telugu|tel|తెలుగు)\b/i },
  { key: 'malayalam', label: 'Malayalam', flag: '', nativeName: 'മലയാളം', regex: /\b(malayalam|mal|മലയാളം)\b/i },
  { key: 'kannada', label: 'Kannada', flag: '', nativeName: 'ಕನ್ನಡ', regex: /\b(kannada|kan|ಕನ್ನಡ)\b/i },
  { key: 'japanese', label: 'Japanese', flag: '', nativeName: '日本語', regex: /\b(japanese|jap|jpn|anime|日本語)\b/i },
  { key: 'korean', label: 'Korean', flag: '', nativeName: '한국어', regex: /\b(korean|kor|k-drama|한국어)\b/i },
  { key: 'spanish', label: 'Spanish', flag: '', nativeName: 'Español', regex: /\b(spanish|esp|español)\b/i },
  { key: 'french', label: 'French', flag: '', nativeName: 'Français', regex: /\b(french|fr|français)\b/i },
  { key: 'chinese', label: 'Chinese', flag: '', nativeName: '中文', regex: /\b(chinese|mandarin|cantonese|chi|中文)\b/i },
  { key: 'arabic', label: 'Arabic', flag: '', nativeName: 'العربية', regex: /\b(arabic|ara|العربية)\b/i },
  { key: 'russian', label: 'Russian', flag: '', nativeName: 'Русский', regex: /\b(russian|rus|русский)\b/i }
];

function getAvailableAudioTracks() {
  const player = document.getElementById('videoPlayer');
  const detectedTracks = [];

  // 1. Check HLS.js Adaptive Bitrate Audio Tracks
  if (window.hlsPlayerInstance && window.hlsPlayerInstance.audioTracks && window.hlsPlayerInstance.audioTracks.length > 0) {
    for (let i = 0; i < window.hlsPlayerInstance.audioTracks.length; i++) {
      const tr = window.hlsPlayerInstance.audioTracks[i];
      let langName = tr.name || tr.lang || `Track ${i + 1}`;
      for (const kl of CINEBOX_AUDIO_LANGUAGES) {
        if (kl.regex.test(langName) || (tr.lang && kl.regex.test(tr.lang))) {
          langName = kl.label;
          break;
        }
      }
      detectedTracks.push({
        id: `hls-${i}`,
        type: 'hls',
        hlsIdx: i,
        label: langName,
        desc: `HLS Audio Track ${i + 1} (${tr.lang || 'Default'})`,
        enabled: window.hlsPlayerInstance.audioTrack === i
      });
    }
    return detectedTracks;
  }

  // 2. Check Native HTML5 Video audioTracks
  if (player && player.audioTracks && player.audioTracks.length > 0) {
    for (let i = 0; i < player.audioTracks.length; i++) {
      const tr = player.audioTracks[i];
      let langName = tr.label || tr.language || `Track ${i + 1}`;
      for (const kl of CINEBOX_AUDIO_LANGUAGES) {
        if (kl.regex.test(langName) || (tr.language && kl.regex.test(tr.language))) {
          langName = kl.label;
          break;
        }
      }
      detectedTracks.push({
        id: `native-${i}`,
        type: 'native',
        nativeIdx: i,
        label: langName,
        desc: `Embedded Track ${i + 1} (${tr.language || 'Multi-channel'})`,
        enabled: tr.enabled
      });
    }
    return detectedTracks;
  }

  // 3. Parse language metadata from Title & URL
  const streamTitle = window.currentActiveStreamTitle || '';
  const item = window.currentItem || {};
  const titleToCheck = `${streamTitle} ${item.title || ''} ${item.url || ''}`;
  const foundLanguages = [];

  for (const kl of CINEBOX_AUDIO_LANGUAGES) {
    if (kl.regex.test(titleToCheck)) {
      if (!foundLanguages.some((l) => l.key === kl.key)) {
        foundLanguages.push(kl);
      }
    }
  }

  const isDualAudio = /\b(dual\s*audio|multi\s*audio|multi\s*dub|dual)\b/i.test(titleToCheck);

  if (foundLanguages.length > 1) {
    foundLanguages.forEach((lang, idx) => {
      const channelMode = idx === 0 ? 'left-channel' : idx === 1 ? 'right-channel' : 'stereo';
      detectedTracks.push({
        id: `lang-${lang.key}`,
        type: 'channel',
        channelMode: channelMode,
        label: `${lang.label} (Dual Audio)`,
        nativeName: lang.nativeName,
        desc:
          idx === 0
            ? `Dual Audio Track 1 (Left Channel) • ${lang.nativeName}`
            : idx === 1
              ? `Dual Audio Track 2 (Right Channel) • ${lang.nativeName}`
              : `Track ${idx + 1} (${lang.label}) • ${lang.nativeName}`
      });
    });

    detectedTracks.push({
      id: 'stereo',
      type: 'channel',
      channelMode: 'stereo',
      label: 'Stereo Master (All Channels)',
      desc: 'Combined stereo mix'
    });

    return detectedTracks;
  }

  if (isDualAudio && foundLanguages.length === 0) {
    return [
      {
        id: 'lang-hindi',
        type: 'channel',
        channelMode: 'left-channel',
        label: 'Hindi (Dual Audio Dub 1)',
        desc: 'Left Audio Channel • Hindi Dub'
      },
      {
        id: 'lang-english',
        type: 'channel',
        channelMode: 'right-channel',
        label: 'English (Dual Audio Dub 2)',
        desc: 'Right Audio Channel • English Original'
      },
      {
        id: 'stereo',
        type: 'channel',
        channelMode: 'stereo',
        label: 'Stereo Master (All Channels)',
        desc: 'Combined original audio output'
      }
    ];
  }

  let singleLang = foundLanguages.length === 1 ? foundLanguages[0] : null;
  if (!singleLang) {
    if (item.tag && /bangla|natok/i.test(item.tag)) {
      singleLang = { key: 'bangla', label: 'Bangla', nativeName: 'বাংলা' };
    } else if (item.tag && /hindi|bollywood/i.test(item.tag)) {
      singleLang = { key: 'hindi', label: 'Hindi', nativeName: 'हिन्दी' };
    } else {
      singleLang = { key: 'original', label: 'Original Audio (Main)', nativeName: 'Main Audio' };
    }
  }

  return [
    {
      id: 'stereo',
      type: 'channel',
      channelMode: 'stereo',
      label: `${singleLang.label} (Original Master)`,
      isSingle: true,
      desc: 'Single Audio Track Available • Stereo 2.0 / 5.1 Surround'
    }
  ];
}

function detectAndRenderAudioTracks() {
  const container = document.getElementById('dynamicAudioTracksContainer');
  if (!container) return;

  const tracks = getAvailableAudioTracks();
  const isSingle = tracks.length === 1 || (tracks.length === 1 && tracks[0].isSingle);
  const settings = window.playerSettings || {};
  const isDisabled = settings.audioTrackMode === 'disable';

  const badgeEl = document.getElementById('cpAudioTrackCountBadge');
  if (badgeEl) {
    if (tracks.length > 1) {
      badgeEl.textContent = tracks.length;
      badgeEl.style.display = 'inline-flex';
    } else {
      badgeEl.style.display = 'none';
    }
  }

  let html = `
    <div class="yt-group-label">AUDIO TRACK (VLC TRACK SELECTOR)</div>
    <div class="yt-submenu-item ${isDisabled ? 'active' : ''}" data-audiomode="disable" onclick="selectAudioTrackMode('disable', 'Disabled (Mute)')">
      <div class="yt-submenu-item-main">
        <span class="yt-opt-title">Disable</span>
        <span class="yt-opt-desc">Mute all audio playback</span>
      </div>
      <span class="yt-check-icon"><i data-lucide="check" style="width: 15px; height: 15px;"></i></span>
    </div>
  `;

  if (isSingle) {
    const tr = tracks[0];
    const isSelected =
      !isDisabled &&
      (!settings.audioTrackMode ||
        settings.audioTrackMode === 'stereo' ||
        settings.audioTrackMode === tr.id);
    const safeTitle = typeof escapeQuotes === 'function' ? escapeQuotes(tr.label) : tr.label;
    const safeLabel = typeof escapeHtml === 'function' ? escapeHtml(tr.label) : tr.label;
    const safeDesc = typeof escapeHtml === 'function' ? escapeHtml(tr.desc) : tr.desc;
    html += `
      <div class="yt-submenu-item ${isSelected ? 'active' : ''}" data-audiomode="${tr.id}" onclick="selectAudioTrackMode('${tr.channelMode || 'stereo'}', '${safeTitle}')">
        <div class="yt-submenu-item-main">
          <span class="yt-opt-title">Track 1: ${safeLabel}</span>
          <span class="yt-opt-desc">${safeDesc}</span>
        </div>
        <span class="yt-check-icon"><i data-lucide="check" style="width: 15px; height: 15px;"></i></span>
      </div>
    `;
  } else {
    tracks.forEach((tr, idx) => {
      const modeVal = tr.channelMode || tr.id;
      let isSelected = false;
      if (!isDisabled) {
        if (settings.audioTrackMode === modeVal) {
          isSelected = true;
        } else if (settings.audioTrackMode === tr.id) {
          isSelected = true;
        } else if (!settings.audioTrackMode && idx === 0) {
          isSelected = true;
        }
      }

      const trackNum = idx + 1;
      const nIdx = tr.nativeIdx !== undefined ? tr.nativeIdx : -1;
      const hIdx = tr.hlsIdx !== undefined ? tr.hlsIdx : -1;
      const safeTitle = typeof escapeQuotes === 'function' ? escapeQuotes(tr.label) : tr.label;
      const safeLabel = typeof escapeHtml === 'function' ? escapeHtml(tr.label) : tr.label;
      const safeDesc = typeof escapeHtml === 'function' ? escapeHtml(tr.desc) : tr.desc;

      html += `
        <div class="yt-submenu-item ${isSelected ? 'active' : ''}" data-audiomode="${modeVal}" onclick="selectAudioTrackMode('${modeVal}', '${safeTitle}', ${nIdx}, ${hIdx})">
          <div class="yt-submenu-item-main">
            <span class="yt-opt-title">Track ${trackNum}: ${safeLabel}</span>
            <span class="yt-opt-desc">${safeDesc}</span>
          </div>
          <span class="yt-check-icon"><i data-lucide="check" style="width: 15px; height: 15px;"></i></span>
        </div>
      `;
    });
  }

  const topAudioBadge = document.getElementById('cpAudioTrackBadge');
  if (topAudioBadge) {
    if (tracks.length > 1) {
      topAudioBadge.textContent = `Audio: ${settings.audioTrackTitle || 'Stereo'}`;
      topAudioBadge.style.display = 'inline-flex';
    } else {
      topAudioBadge.style.display = 'none';
    }
  }

  container.innerHTML = html;
  if (typeof refreshLucideIcons === 'function') refreshLucideIcons();
}

function openAudioTrackDirectMenu(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  if (typeof openYouTubeSettingsPopup === 'function') openYouTubeSettingsPopup();
  if (typeof openYouTubeSubmenu === 'function') openYouTubeSubmenu('ytSubAudioTrack');
}

function promptExternalAudioUrl() {
  const settings = window.playerSettings || {};
  const defaultUrl = settings.externalAudioUrl || '';
  const url = prompt('Enter direct audio stream URL (e.g. .mp3, .m4a, .aac link):', defaultUrl);
  if (url && url.trim()) {
    const cleanUrl = url.trim();
    const title = cleanUrl.split('/').pop().split('?')[0] || 'Custom Audio Track';
    loadExternalAudio(cleanUrl, title);
  }
}

function openExternalAudioPicker() {
  const fileInput = document.getElementById('externalAudioFileInput');
  if (fileInput) fileInput.click();
}

function handleExternalAudioFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  const blobUrl = URL.createObjectURL(file);
  loadExternalAudio(blobUrl, file.name);
  e.target.value = '';
}

function loadExternalAudio(url, title = 'External Audio Track') {
  const player = document.getElementById('videoPlayer');
  if (!player || !url) return;

  if (externalAudioPlayer) {
    externalAudioPlayer.pause();
    externalAudioPlayer = null;
  }

  externalAudioPlayer = new Audio(url);
  externalAudioPlayer.preload = 'auto';
  externalAudioPlayer.volume = player.volume;
  externalAudioPlayer.playbackRate = player.playbackRate;
  const settings = window.playerSettings || {};
  externalAudioPlayer.currentTime = Math.max(0, player.currentTime + (settings.externalAudioOffset || 0));

  player.muted = true;
  if (typeof updateVolumeUI === 'function') updateVolumeUI();

  if (!player.paused) {
    externalAudioPlayer.play().catch(() => {});
  }

  settings.audioTrackMode = 'external';
  settings.audioTrackTitle = `External: ${title}`;
  settings.externalAudioUrl = url;
  settings.externalAudioTitle = title;

  if (typeof savePlayerSettings === 'function') savePlayerSettings();
  if (typeof updateCustomizerUIState === 'function') updateCustomizerUIState();
  if (typeof updateYouTubeMenuState === 'function') updateYouTubeMenuState();
  if (typeof showToast === 'function') showToast(`Loaded external audio: ${title}`);
}

function nudgeAudioSync(delta) {
  const settings = window.playerSettings || {};
  settings.externalAudioOffset = Math.round(((settings.externalAudioOffset || 0) + delta) * 10) / 10;
  if (typeof savePlayerSettings === 'function') savePlayerSettings();

  const valEl = document.getElementById('ytAudioSyncVal');
  if (valEl) {
    valEl.textContent = `${settings.externalAudioOffset > 0 ? '+' : ''}${settings.externalAudioOffset}s`;
  }

  const player = document.getElementById('videoPlayer');
  if (externalAudioPlayer && player) {
    externalAudioPlayer.currentTime = Math.max(0, player.currentTime + settings.externalAudioOffset);
  }

  if (typeof showToast === 'function') {
    showToast(`Audio sync offset: ${settings.externalAudioOffset > 0 ? '+' : ''}${settings.externalAudioOffset}s`);
  }
}

function resetAudioSync() {
  const settings = window.playerSettings || {};
  settings.externalAudioOffset = 0.0;
  if (typeof savePlayerSettings === 'function') savePlayerSettings();

  const valEl = document.getElementById('ytAudioSyncVal');
  if (valEl) valEl.textContent = '0.0s';

  const player = document.getElementById('videoPlayer');
  if (externalAudioPlayer && player) {
    externalAudioPlayer.currentTime = player.currentTime;
  }

  if (typeof showToast === 'function') showToast('Audio sync reset to 0.0s');
}

function handleAudioBoostGain(gainVal) {
  const gain = parseInt(gainVal, 10);
  const settings = window.playerSettings || {};
  settings.audioBoostGain = gain;
  if (typeof savePlayerSettings === 'function') savePlayerSettings();

  setupAudioBooster();
  if (audioGainNode && audioCtx) {
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    audioGainNode.gain.setValueAtTime(gain / 100, audioCtx.currentTime);
  }

  const slider = document.getElementById('sliderAudioBoost');
  if (slider) slider.value = gain;
  const sliderVal = document.getElementById('valAudioGainSlider');
  if (sliderVal) sliderVal.textContent = `${gain}%`;
  const badgeVal = document.getElementById('valAudioBoostText');
  if (badgeVal) {
    badgeVal.textContent = gain === 100 ? '100% (Normal)' : `${gain}% Boost`;
  }

  ['chipGain100', 'chipGain150', 'chipGain200', 'chipGain300'].forEach((id) => {
    const chip = document.getElementById(id);
    if (!chip) return;
    const chipVal = parseInt(id.replace('chipGain', ''), 10);
    chip.classList.toggle('active', chipVal === gain);
  });

  if (typeof showToast === 'function') showToast(`Volume Booster: ${gain}%`);
}

function setAudioProfile(profile) {
  const settings = window.playerSettings || {};
  settings.audioProfile = profile;
  if (typeof savePlayerSettings === 'function') savePlayerSettings();

  setupAudioBooster();
  applyAudioSettings();

  const valText = document.getElementById('valAudioProfileText');
  if (valText) {
    valText.textContent = profile.charAt(0).toUpperCase() + profile.slice(1);
  }

  document.querySelectorAll('#tabAudio .preset-card').forEach((card) => {
    card.classList.toggle('active', card.getAttribute('data-profile') === profile);
  });

  const labels = {
    standard: 'Standard (Flat)',
    dialogue: 'Dialogue Enhancer (Vocal Focus)',
    bass: 'Bass Cinema Booster',
    night: 'Night Mode (Dynamic Compression)'
  };
  if (typeof showToast === 'function') showToast(`Audio Profile: ${labels[profile] || profile}`);
}

function applyAudioSettings() {
  if (!isAudioEngineInitialized || !audioCtx) return;

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }

  const settings = window.playerSettings || {};
  const gain = (settings.audioBoostGain || 100) / 100;
  if (audioGainNode) {
    audioGainNode.gain.setValueAtTime(gain, audioCtx.currentTime);
  }

  const profile = settings.audioProfile || 'standard';
  if (!audioFilterNode || !audioCompressorNode) return;

  if (profile === 'dialogue') {
    audioFilterNode.type = 'peaking';
    audioFilterNode.frequency.setValueAtTime(2500, audioCtx.currentTime);
    audioFilterNode.gain.setValueAtTime(6.0, audioCtx.currentTime);
    audioFilterNode.Q.setValueAtTime(1.2, audioCtx.currentTime);

    audioCompressorNode.threshold.setValueAtTime(-24, audioCtx.currentTime);
    audioCompressorNode.knee.setValueAtTime(30, audioCtx.currentTime);
    audioCompressorNode.ratio.setValueAtTime(4, audioCtx.currentTime);
  } else if (profile === 'bass') {
    audioFilterNode.type = 'lowshelf';
    audioFilterNode.frequency.setValueAtTime(120, audioCtx.currentTime);
    audioFilterNode.gain.setValueAtTime(7.0, audioCtx.currentTime);

    audioCompressorNode.threshold.setValueAtTime(-18, audioCtx.currentTime);
    audioCompressorNode.ratio.setValueAtTime(3, audioCtx.currentTime);
  } else if (profile === 'night') {
    audioFilterNode.type = 'allpass';

    audioCompressorNode.threshold.setValueAtTime(-32, audioCtx.currentTime);
    audioCompressorNode.knee.setValueAtTime(40, audioCtx.currentTime);
    audioCompressorNode.ratio.setValueAtTime(12, audioCtx.currentTime);
    audioCompressorNode.attack.setValueAtTime(0.003, audioCtx.currentTime);
    audioCompressorNode.release.setValueAtTime(0.25, audioCtx.currentTime);
  } else {
    audioFilterNode.type = 'allpass';
    audioCompressorNode.threshold.setValueAtTime(-10, audioCtx.currentTime);
    audioCompressorNode.ratio.setValueAtTime(1, audioCtx.currentTime);
  }
}
