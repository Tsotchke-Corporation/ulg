// Device-loss notifications live as long as the device, including after a step
// returns or releases its outputs. Construct them outside the step's lexical
// scope so the notification chain retains only this small cell and the caller's
// actual notifier, not completed simulation proposals or source generations.
export function createSphDeviceLossRelay(lossState, onDeviceLost) {
  return function notifySphDeviceLost(info) {
    lossState.info = info;
    if (typeof onDeviceLost === 'function') onDeviceLost(info);
  };
}
