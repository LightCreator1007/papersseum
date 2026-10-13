// Upload checks shared by the browser (before sending) and the server.
export const MAX_BYTES = 1_048_576;
export const GENERIC_UPLOAD_ERROR = "Upload failed, please try again.";

export function checkFile(name: string, size: number): string | null {
  if (!name.toLowerCase().endsWith(".py")) return "Choose a .py file.";
  if (size === 0) return "That file is empty.";
  if (size > MAX_BYTES) return "That file is over 1 MB.";
  return null;
}

export function isUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

// api_create_submission's cooldown error says "Please wait HH:MM:SS before ...".
export function waitText(message: string): string | null {
  const m = /(\d+):(\d{2}):(\d{2})/.exec(message);
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  const seconds = Number(m[3]);
  if (minutes && seconds) return `${minutes} min ${seconds} s`;
  return minutes ? `${minutes} min` : `${seconds} s`;
}

export function uploadErrorMessage(code: string | undefined, message: string): string {
  switch (code) {
    case "PS001":
      return "Submissions are closed for this season.";
    case "PS003":
      return "This bot is banned. Contact the organisers.";
    case "PS004": {
      const wait = waitText(message);
      return wait ? `You can upload again in ${wait}.` : "You uploaded recently. Try again in a few minutes.";
    }
    default:
      return GENERIC_UPLOAD_ERROR;
  }
}
