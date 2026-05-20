export function normalizeApiUrl(rawUrl: string): string {
  const trimmedUrl = rawUrl.trim();
  const urlWithProtocol = /^https?:\/\//i.test(trimmedUrl)
    ? trimmedUrl
    : `https://${trimmedUrl}`;
  const url = new URL(urlWithProtocol);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Server URL must use http or https");
  }

  return url.toString().replace(/\/$/, "");
}

export function isValidApiUrl(rawUrl: string): boolean {
  try {
    normalizeApiUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}

export function getInstanceId(apiUrl: string): string {
  return apiUrl
    .replace(/^https?:\/\//i, "")
    .replace(/[^a-z0-9-]/gi, "-")
    .toLowerCase();
}

export function getDefaultInstanceName(apiUrl: string): string {
  const hostname = new URL(apiUrl).hostname.replace(/^www\./i, "");
  const [name] = hostname.split(".");

  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
