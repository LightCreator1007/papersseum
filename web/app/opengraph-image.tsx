import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Papersseum: write a bot, take the board.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#121212";
const INK = "#e8e8e6";
const CELLS: [number, number][] = [[1, 0], [0, 1], [2, 1], [1, 2]];

export default async function Image() {
  const [font, board] = await Promise.all([
    readFile(join(process.cwd(), "node_modules/geist/dist/fonts/geist-sans/Geist-SemiBold.ttf")),
    readFile(join(process.cwd(), "public/board-dark.svg")),
  ]);
  const boardUrl = `data:image/svg+xml;base64,${board.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 72,
          background: PAPER,
          color: INK,
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", width: 620 }}>
          <svg width="120" height="120" viewBox="0 0 3 3">
            {CELLS.map(([x, y]) => (
              <rect key={`${x}${y}`} x={x} y={y} width="1" height="1" fill={INK} />
            ))}
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 80, fontWeight: 600, letterSpacing: -2, lineHeight: 1.04, whiteSpace: "nowrap" }}>Write a bot.</div>
            <div style={{ fontSize: 80, fontWeight: 600, letterSpacing: -2, lineHeight: 1.04, whiteSpace: "nowrap" }}>Take the board.</div>
            <div style={{ fontSize: 30, fontWeight: 600, marginTop: 28, opacity: 0.6 }}>Papersseum</div>
          </div>
        </div>
        <img src={boardUrl} width={440} height={440} alt="" style={{ imageRendering: "pixelated" }} />
      </div>
    ),
    { ...size, fonts: [{ name: "Geist", data: font, weight: 600, style: "normal" }] },
  );
}
