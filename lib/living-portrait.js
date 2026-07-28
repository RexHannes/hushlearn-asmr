const PORTRAIT_WIDTH = 960;
const PORTRAIT_HEIGHT = 540;
const SOURCE_WIDTH = 1672;
const SOURCE_HEIGHT = 941;
const SCALE_X = PORTRAIT_WIDTH / SOURCE_WIDTH;
const SCALE_Y = PORTRAIT_HEIGHT / SOURCE_HEIGHT;

const MOUTH = { x: 1073, y: 482, radiusX: 47, radiusY: 22 };

function speakingAmount(time) {
  const primary = Math.sin(time * 0.019);
  const secondary = Math.sin(time * 0.011 + 1.7);
  return Math.max(0.08, Math.min(1, 0.5 + primary * 0.34 + secondary * 0.2));
}

function drawSpeakingMouth(context, image, amount) {
  if (amount < 0.01) return;

  const x = MOUTH.x * SCALE_X;
  const y = MOUTH.y * SCALE_Y;
  const radiusX = MOUTH.radiusX * SCALE_X;
  const radiusY = MOUTH.radiusY * SCALE_Y;
  const sourceX = MOUTH.x - MOUTH.radiusX;
  const sourceWidth = MOUTH.radiusX * 2;
  const separation = 4.5 * amount;

  context.save();
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, -0.035, 0, Math.PI * 2);
  context.clip();

  context.drawImage(
    image,
    sourceX,
    MOUTH.y - 22,
    sourceWidth,
    44,
    sourceX * SCALE_X,
    (MOUTH.y - 22 - separation * 0.5) * SCALE_Y,
    sourceWidth * SCALE_X,
    (44 + separation) * SCALE_Y,
  );

  context.beginPath();
  context.ellipse(
    x,
    y + 1.5 * SCALE_Y,
    (17 + amount * 5) * SCALE_X,
    (1.1 + amount * 2.4) * SCALE_Y,
    -0.035,
    0,
    Math.PI * 2,
  );
  context.fillStyle = `rgba(35, 12, 15, ${0.22 + amount * 0.2})`;
  context.fill();
  context.restore();
}

export function mountLivingPortrait(canvas, source) {
  if (!canvas) return () => {};

  const context = canvas.getContext("2d", { alpha: false });
  const image = new Image();
  const shell = canvas.closest(".app-shell");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame = 0;
  let stopped = false;

  canvas.width = PORTRAIT_WIDTH;
  canvas.height = PORTRAIT_HEIGHT;

  const render = (time = 0) => {
    if (stopped || !image.complete) return;
    context.drawImage(image, 0, 0, PORTRAIT_WIDTH, PORTRAIT_HEIGHT);

    if (!reduceMotion.matches) {
      const speaking = shell?.classList.contains("is-speaking");
      if (speaking) drawSpeakingMouth(context, image, speakingAmount(time));
    }

    canvas.classList.add("ready");
    if (!reduceMotion.matches && !document.hidden) {
      frame = window.requestAnimationFrame(render);
    }
  };

  const resume = () => {
    window.cancelAnimationFrame(frame);
    if (!document.hidden && !stopped) frame = window.requestAnimationFrame(render);
  };

  image.onload = () => render(performance.now());
  image.src = source;
  document.addEventListener("visibilitychange", resume);
  reduceMotion.addEventListener?.("change", resume);

  return () => {
    stopped = true;
    window.cancelAnimationFrame(frame);
    document.removeEventListener("visibilitychange", resume);
    reduceMotion.removeEventListener?.("change", resume);
  };
}
