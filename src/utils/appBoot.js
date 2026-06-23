export function holdAppBoot() {
  document.documentElement.classList.add('app-booting');
}

export function releaseAppBoot() {
  document.documentElement.classList.remove('app-booting');
}

export function releaseAppBootBeforePaint() {
  const frame = window.requestAnimationFrame(releaseAppBoot);
  return () => window.cancelAnimationFrame(frame);
}
