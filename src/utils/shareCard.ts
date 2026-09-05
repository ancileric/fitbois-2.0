/**
 * Draws the week's standings as an image, for sharing into the group chat.
 *
 * Canvas rather than a screenshot library: no dependency, and the card is laid
 * out for a phone conversation rather than being a photo of a web page.
 */

export interface ShareRow {
  name: string;
  cleanWeeks: number;
  outstanding: number;
  standing: "active" | "suspended" | "out";
  potEligible: boolean;
}

export interface ShareCardInput {
  week: number;
  seasonWeeks: number;
  rows: ShareRow[];
  potCount: number;
  inPot: number;
  outstanding: number;
}

const PALETTE = {
  paper: "#14161a",
  card: "#1b1e22",
  ink: "#e9eae6",
  muted: "#a8b0a8",
  line: "#2c3037",
  clean: "#5cb489",
  owed: "#e8836a",
  skip: "#e0a94a",
};

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/** Renders at 2x so it stays sharp when a phone scales it down. */
export const drawShareCard = (input: ShareCardInput): HTMLCanvasElement => {
  const scale = 2;
  const width = 540;
  const rowHeight = 46;
  const headerHeight = 210;
  const height = headerHeight + input.rows.length * rowHeight + 56;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(scale, scale);

  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, width, height);

  const pad = 28;

  ctx.fillStyle = PALETTE.muted;
  ctx.font = "600 12px system-ui, -apple-system, sans-serif";
  ctx.fillText(`WEEK ${input.week} OF ${input.seasonWeeks}`.toUpperCase(), pad, 44);

  ctx.fillStyle = PALETTE.ink;
  ctx.font = "700 40px 'Barlow Condensed', Impact, sans-serif";
  ctx.fillText("FITBROS 3.0", pad, 86);

  // Three numbers that summarise the season at a glance.
  const stats: [string, string, string][] = [
    ["IN FOR THE POT", `${input.potCount}/${input.rows.length}`, PALETTE.clean],
    ["IN THE POT", rupees(input.inPot), PALETTE.ink],
    ["OUTSTANDING", rupees(input.outstanding), input.outstanding ? PALETTE.owed : PALETTE.clean],
  ];
  stats.forEach(([label, value, colour], i) => {
    const x = pad + i * ((width - pad * 2) / 3);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = "600 10px system-ui, -apple-system, sans-serif";
    ctx.fillText(label, x, 126);
    ctx.fillStyle = colour;
    ctx.font = "700 28px 'Barlow Condensed', Impact, sans-serif";
    ctx.fillText(value, x, 156);
  });

  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, 178);
  ctx.lineTo(width - pad, 178);
  ctx.stroke();

  ctx.fillStyle = PALETTE.muted;
  ctx.font = "600 10px system-ui, -apple-system, sans-serif";
  ctx.fillText("PLAYER", pad, 198);
  ctx.textAlign = "right";
  ctx.fillText("CLEAN", width - pad - 96, 198);
  ctx.fillText("OWED", width - pad, 198);
  ctx.textAlign = "left";

  input.rows.forEach((row, i) => {
    const y = headerHeight + i * rowHeight;

    ctx.strokeStyle = PALETTE.line;
    ctx.beginPath();
    ctx.moveTo(pad, y - 14);
    ctx.lineTo(width - pad, y - 14);
    ctx.stroke();

    ctx.fillStyle = row.standing === "out" ? PALETTE.muted : PALETTE.ink;
    ctx.font = "600 17px system-ui, -apple-system, sans-serif";
    ctx.fillText(row.name, pad, y + 10);

    if (row.potEligible) {
      ctx.fillStyle = PALETTE.clean;
      ctx.font = "600 11px system-ui, -apple-system, sans-serif";
      ctx.fillText("• in for the pot", pad + ctx.measureText(row.name).width + 44, y + 10);
    } else if (row.standing !== "active") {
      ctx.fillStyle = row.standing === "out" ? PALETTE.owed : PALETTE.skip;
      ctx.font = "600 11px system-ui, -apple-system, sans-serif";
      ctx.fillText(row.standing.toUpperCase(), pad + ctx.measureText(row.name).width + 44, y + 10);
    }

    ctx.textAlign = "right";
    ctx.fillStyle = PALETTE.ink;
    ctx.font = "600 16px system-ui, -apple-system, sans-serif";
    ctx.fillText(String(row.cleanWeeks), width - pad - 96, y + 10);

    ctx.fillStyle = row.outstanding ? PALETTE.owed : PALETTE.clean;
    ctx.fillText(row.outstanding ? rupees(row.outstanding) : "settled", width - pad, y + 10);
    ctx.textAlign = "left";
  });

  ctx.fillStyle = PALETTE.muted;
  ctx.font = "400 11px system-ui, -apple-system, sans-serif";
  ctx.fillText("A missed week costs ₹500 → ₹2,000. Pay up and you keep your share.", pad, height - 22);

  return canvas;
};

/**
 * Hand the card to the phone's share sheet where that exists, and fall back to a
 * download everywhere else.
 */
export const shareCard = async (input: ShareCardInput): Promise<"shared" | "downloaded"> => {
  const canvas = drawShareCard(input);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not render the card");

  const file = new File([blob], `fitbros-week-${input.week}.png`, { type: "image/png" });
  const navigatorWithShare = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (navigatorWithShare.canShare?.({ files: [file] }) && navigatorWithShare.share) {
    await navigatorWithShare.share({ files: [file], title: `FitBros — week ${input.week}` });
    return "shared";
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  // Revoking in the same tick can cancel the download before the browser has
  // read the blob, so let the click settle first.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "downloaded";
};
