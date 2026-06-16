// Position and size of the map window within the full viewport.
// Derived from the transparent cutout in frame.png (1490x1117):
//   cutout pixel bounds: (242, 60) → (1266, 1048)
export const MAP_WINDOW = {
  left: '16.24%',   // 242 / 1490
  top: '5.37%',     // 60  / 1117
  width: '68.72%',  // 1024 / 1490
  height: '88.45%', // 988  / 1117
} as const
