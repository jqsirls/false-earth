import { Fn, vec3, fract, clamp, mx_rgbtohsv, mx_hsvtorgb } from "three/tsl";

/**
 * TSL Node: Shifts color in HSV space safely.
 * @param color - Input RGB color (vec3)
 * @param shift - Shift amount vec3(Hue, Saturation, Value)
 * x: Hue (Wraps around 0-1)
 * y: Saturation (Clamps 0-1)
 * z: Value (Clamps 0-1)
 */
export const shiftHSV = Fn(([color, shift]: [any, any]) => {
  const hsv = mx_rgbtohsv(color);

  const h = fract(hsv.x.add(shift.x)); 
  const s = clamp(hsv.y.add(shift.y), 0.0, 1.0);
  const v = clamp(hsv.z.add(shift.z), 0.0, 1.0);

  return mx_hsvtorgb(vec3(h, s, v));
});