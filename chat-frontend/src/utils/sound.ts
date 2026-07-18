let audioCtx: AudioContext | null = null;

export const playNotificationSound = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    
    // Resume context if suspended (required by modern browsers)
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    // Create oscillator
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    // Connect
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    // Pleasant "ding" sound
    osc.type = 'sine';
    
    // Frequency envelope
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.05);
    
    // Amplitude envelope
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    
    // Play
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    console.error('Failed to play sound', e);
  }
};
