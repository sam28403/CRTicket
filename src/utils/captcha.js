export function generateCaptcha(length = 5) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

export function drawCaptcha(code) {
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 40;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f2f2f2";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "20px Arial";
  ctx.fillStyle = "#333";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(code, canvas.width / 2, canvas.height / 2);
  return canvas.toDataURL("image/png");
}

export function refreshCaptchaImage(image) {
  const code = generateCaptcha();
  if (image) {
    image.src = drawCaptcha(code);
  }
  return code;
}
