// Load the three PNG files as Image objects before drawing.
// x/y are the top-left of the full 1536x1024 building canvas.
// progress: 0 = closed, 1 = open. Call with the same scene scale for all layers.
export function drawCardshop(ctx, images, x, y, scale, progress) {
  const p = Math.max(0, Math.min(1, progress));
  ctx.save(); ctx.translate(x,y); ctx.scale(scale,scale);
  ctx.drawImage(images.building,0,0);
  ctx.save(); ctx.beginPath(); ctx.rect(648,548,238,250); ctx.clip();
  ctx.drawImage(images.left,646-120*p,546);
  ctx.drawImage(images.right,766+120*p,546);
  ctx.restore(); ctx.restore();
}
