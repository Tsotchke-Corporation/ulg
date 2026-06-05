let interval = null;
let progress = 0;
let childId = null;

self.addEventListener('message', (event) => {
  const message = event.data;
  if (message.type === 'start') {
    childId = message.childId;
    progress = 0;
    interval = setInterval(() => {
      progress = Math.min(1, progress + 0.08 + Math.random() * 0.04);
      self.postMessage({
        type: 'progress',
        childId,
        progress,
        sample: Math.sin(progress * Math.PI)
      });
      if (progress >= 1) {
        clearInterval(interval);
        self.postMessage({ type: 'complete', childId });
      }
    }, 250);
  }
  if (message.type === 'cancel') {
    clearInterval(interval);
    self.postMessage({ type: 'cancelled', childId });
  }
});
