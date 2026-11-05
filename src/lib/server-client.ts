"use client";

export interface ServerResult {
  blob: Blob;
  filename: string;
  info: Record<string, unknown>;
}

/**
 * Send files to a server-side processing endpoint and receive the result.
 * Uses XHR so we can report real upload progress.
 */
export function processOnServer(
  tool: string,
  files: File[],
  options: Record<string, unknown>,
  onProgress?: (fraction: number | null, label: string) => void,
): Promise<ServerResult> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    files.forEach((f) => form.append("files", f, f.name));
    form.append("options", JSON.stringify(options));
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/process/${tool}`);
    xhr.responseType = "blob";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total, `Uploading ${Math.round((e.loaded / e.total) * 100)}%`);
    };
    xhr.upload.onload = () => onProgress?.(null, "Processing on secure server…");
    xhr.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress?.(e.loaded / e.total, "Downloading result…");
    };
    xhr.onerror = () => reject(new Error("Network error — check your connection and try again."));
    xhr.ontimeout = () => reject(new Error("The server took too long to respond."));
    xhr.timeout = 10 * 60 * 1000;
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const cd = xhr.getResponseHeader("content-disposition") || "";
        const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
        let info: Record<string, unknown> = {};
        try {
          info = JSON.parse(decodeURIComponent(xhr.getResponseHeader("x-ffd-info") || "%7B%7D"));
        } catch {
          /* ignore */
        }
        resolve({ blob: xhr.response as Blob, filename: m ? decodeURIComponent(m[1]) : "result", info });
      } else {
        try {
          const text = await (xhr.response as Blob).text();
          const data = JSON.parse(text);
          reject(new Error(data.error || `Request failed (${xhr.status}).`));
        } catch {
          reject(new Error(xhr.status === 413 ? "File too large." : `Request failed (${xhr.status}).`));
        }
      }
    };
    xhr.send(form);
  });
}
