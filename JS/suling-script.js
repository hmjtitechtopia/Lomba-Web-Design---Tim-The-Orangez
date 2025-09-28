// suling sunda - the orangez - alif, daffa, aldi
let konteksAudio;
let volumemaster;
let efekgema;
let noteyangmain = {};
let tombolkepencet = new Set();

// data nada sunda sama frekuensinya
const namanada = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'Do'];
const frek = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];

let tampilannada = document.getElementById('current-note');
let lubang2 = document.querySelectorAll('.hole');
let labeltombol = document.querySelectorAll('.key-label');

window.addEventListener('load', function() {
    setupaudio();
    buatevent();
});

function setupaudio() {
    try {
        konteksAudio = new (window.AudioContext || window.webkitAudioContext)();
        
        volumemaster = konteksAudio.createGain();
        volumemaster.gain.value = 0.35;
        
        bikinefekgema();
        
        volumemaster.connect(efekgema);
        efekgema.connect(konteksAudio.destination);
        
    } catch (err) {
        console.log('gagal setup audio:', err);
    }
}

function bikinefekgema() {
    efekgema = konteksAudio.createConvolver();
    
    let sampleRate = konteksAudio.sampleRate;
    let panjang = sampleRate * 1.3; 
    let buffer = konteksAudio.createBuffer(2, panjang, sampleRate);
    
    for (let ch = 0; ch < 2; ch++) {
        let data = buffer.getChannelData(ch);
        for (let i = 0; i < panjang; i++) {
            let decay = Math.pow(1 - i / panjang, 2.2);
            data[i] = (Math.random() * 2 - 1) * decay * 0.18;
        }
    }
    
    efekgema.buffer = buffer;
}

function mainadanada(indexnada, tahan = false) {
    if (indexnada < 0 || indexnada >= frek.length) return;
    
    if (konteksAudio.state === 'suspended') {
        konteksAudio.resume();
    }
    
    let freq = frek[indexnada];
    let namanota = namanada[indexnada];
    
    if (tahan) {
        if (noteyangmain[indexnada]) return;
        
        let suara = bikinsuarasuling(freq, true);
        noteyangmain[indexnada] = suara;
    } else {
        bikinsuarasuling(freq, false);
    }
    
    // update tampilan
    tampilkanNota(namanota);
    animasilubang(indexnada, tahan);
}

function bikinsuarasuling(frekuensi, ditahan) {
    let mulaiWaktu = konteksAudio.currentTime;
    let grupsuara = {};
    
    // osilator utama 
    let osUtama = konteksAudio.createOscillator();
    osUtama.type = 'sine';
    osUtama.frequency.value = frekuensi;
    
    // harmonik 2
    let harmonik2 = konteksAudio.createOscillator();
    harmonik2.type = 'sine';
    harmonik2.frequency.value = frekuensi * 2;
    
    // harmonik 3
    let harmonik3 = konteksAudio.createOscillator();
    harmonik3.type = 'sine';
    harmonik3.frequency.value = frekuensi * 3.1; // sedikit detune biar natural
    
    // suara nafas
    let bufferNafas = buatsuaranafas();
    let sourceNafas = konteksAudio.createBufferSource();
    sourceNafas.buffer = bufferNafas;
    sourceNafas.loop = true;
    
    // gain2 buat mixing
    let gainUtama = konteksAudio.createGain();
    let gainHarm2 = konteksAudio.createGain();
    let gainHarm3 = konteksAudio.createGain();
    let gainNafas = konteksAudio.createGain();
    let gainAkhir = konteksAudio.createGain();
    
    // set volume masing2
    gainUtama.gain.value = 0.75;
    gainHarm2.gain.value = 0.28;
    gainHarm3.gain.value = 0.15;
    gainNafas.gain.value = 0.12;
    
    // filter biar suaranya bagus
    let filter = konteksAudio.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frekuensi * 3.8;
    filter.Q.value = 1.4;
    
    let filterNafas = konteksAudio.createBiquadFilter();
    filterNafas.type = 'highpass';
    filterNafas.frequency.value = 750;
    filterNafas.Q.value = 0.9;
    
    if (ditahan) {
        gainAkhir.gain.setValueAtTime(0, mulaiWaktu);
        gainAkhir.gain.linearRampToValueAtTime(1, mulaiWaktu + 0.06);
    } else {
        gainAkhir.gain.setValueAtTime(0, mulaiWaktu);
        gainAkhir.gain.linearRampToValueAtTime(1, mulaiWaktu + 0.04);
        gainAkhir.gain.linearRampToValueAtTime(0.82, mulaiWaktu + 0.09);
        gainAkhir.gain.setValueAtTime(0.82, mulaiWaktu + 0.6);
        gainAkhir.gain.linearRampToValueAtTime(0, mulaiWaktu + 0.75);
    }
    
    // routing audio all
    osUtama.connect(gainUtama);
    harmonik2.connect(gainHarm2);
    harmonik3.connect(gainHarm3);
    sourceNafas.connect(filterNafas);
    filterNafas.connect(gainNafas);
    
    gainUtama.connect(filter);
    gainHarm2.connect(filter);
    gainHarm3.connect(filter);
    gainNafas.connect(filter);
    filter.connect(gainAkhir);
    gainAkhir.connect(volumemaster);
    
    // mulai semua oscillator
    osUtama.start(mulaiWaktu);
    harmonik2.start(mulaiWaktu);
    harmonik3.start(mulaiWaktu);
    sourceNafas.start(mulaiWaktu);
    
    // stop otomatis kalo tdk di tahan
    if (!ditahan) {
        let waktuStop = mulaiWaktu + 0.75;
        osUtama.stop(waktuStop);
        harmonik2.stop(waktuStop);
        harmonik3.stop(waktuStop);
        sourceNafas.stop(waktuStop);
    }
    
    // simpen referensi
    grupsuara.osUtama = osUtama;
    grupsuara.harmonik2 = harmonik2;
    grupsuara.harmonik3 = harmonik3;
    grupsuara.sourceNafas = sourceNafas;
    grupsuara.gainAkhir = gainAkhir;
    
    return grupsuara;
}

function buatsuaranafas() {
    let ukuranBuffer = konteksAudio.sampleRate * 0.08;
    let buffer = konteksAudio.createBuffer(1, ukuranBuffer, konteksAudio.sampleRate);
    let data = buffer.getChannelData(0);
    
    for (let i = 0; i < ukuranBuffer; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.09;
    }
    
    return buffer;
}

function stopnada(indexnada) {
    if (noteyangmain[indexnada]) {
        let suara = noteyangmain[indexnada];
        let waktuStop = konteksAudio.currentTime;
        
        // fade out pelan2
        suara.gainAkhir.gain.linearRampToValueAtTime(0, waktuStop + 0.08);
        
        // stop setelah fade
        setTimeout(function() {
            try {
                suara.osUtama.stop();
                suara.harmonik2.stop();
                suara.harmonik3.stop();
                suara.sourceNafas.stop();
            } catch (e) {
                // ignore kalau error
            }
        }, 100);
        
        delete noteyangmain[indexnada];
        stopanimasi(indexnada);
    }
}

function tampilkanNota(namanota) {
    tampilannada.textContent = namanota;
    tampilannada.classList.add('playing');
    
    // bersihin kalo ga ada yg main
    setTimeout(function() {
        if (Object.keys(noteyangmain).length === 0) {
            tampilannada.textContent = '';
            tampilannada.classList.remove('playing');
        }
    }, 900);
}

function animasilubang(indexnada, ditahan) {
    let lubang = lubang2[indexnada];
    let label = labeltombol[indexnada];
    
    if (!lubang) return;
    
    lubang.classList.add(ditahan ? 'pressed' : 'active');
    if (label) label.classList.add('active');
    
    // bikin efek gelombang
    buatgelombang(lubang);
    
    if (!ditahan) {
        setTimeout(function() {
            lubang.classList.remove('active');
            if (label) label.classList.remove('active');
        }, 220);
    }
}

function stopanimasi(indexnada) {
    let lubang = lubang2[indexnada];
    let label = labeltombol[indexnada];
    
    if (lubang) {
        lubang.classList.remove('pressed', 'active');
    }
    if (label) {
        label.classList.remove('active');
    }
}

function buatgelombang(lubang) {
    let gelombang = document.createElement('div');
    gelombang.className = 'sound-wave';
    lubang.appendChild(gelombang);
    
    // hapus setelah animasi kelar
    setTimeout(function() {
        if (gelombang.parentNode) {
            gelombang.parentNode.removeChild(gelombang);
        }
    }, 550);
}

function buatevent() {
    // event mouse/touch buat lubang suling
    for (let i = 0; i < lubang2.length; i++) {
        (function(index) {
            let lubang = lubang2[index];
            
            // mouse
            lubang.addEventListener('mousedown', function(e) {
                e.preventDefault();
                mainadanada(index, true);
            });
            
            lubang.addEventListener('mouseup', function() {
                stopnada(index);
            });
            
            lubang.addEventListener('mouseleave', function() {
                stopnada(index);
            });
            
            // touch
            lubang.addEventListener('touchstart', function(e) {
                e.preventDefault();
                mainadanada(index, true);
            });
            
            lubang.addEventListener('touchend', function(e) {
                e.preventDefault();
                stopnada(index);
            });
        })(i);
    }
    
    // keyboard event
    document.addEventListener('keydown', function(e) {
        let nomorkey = parseInt(e.key);
        if (nomorkey >= 1 && nomorkey <= 8 && !tombolkepencet.has(nomorkey)) {
            tombolkepencet.add(nomorkey);
            mainadanada(nomorkey - 1, true);
        }
    });
    
    document.addEventListener('keyup', function(e) {
        let nomorkey = parseInt(e.key);
        if (nomorkey >= 1 && nomorkey <= 8) {
            tombolkepencet.delete(nomorkey);
            stopnada(nomorkey - 1);
        }
    });
    
    // resume audio pas page terlihat
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden && konteksAudio) {
            konteksAudio.resume();
        }
    });
}