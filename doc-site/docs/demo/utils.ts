const BASE_URL = 'https://webav-tech.github.io/WebAV';
export function assetsPrefix<T extends string[] | Record<string, string>>(
  assetsURL: T,
): T {
  const base =
    window.location.hostname.includes('webcontainer.io') ||
    window.location.hostname.includes('stackblitz.io') ||
    window.location.hostname.includes('csb.app')
      ? BASE_URL
      : '';
  const prefix = process.env.NODE_ENV === 'development' ? '/' : '/WebAV/';
  if (Array.isArray(assetsURL)) {
    return assetsURL.map((url) => `${base}${prefix}${url}`) as T;
  }

  return Object.fromEntries(
    Object.entries(assetsURL).map(([k, v]) => [k, `${base}${prefix}${v}`]),
  ) as T;
}

export async function createFileWriter(
  extName = 'mp4',
): Promise<FileSystemWritableFileStream> {
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAV-export-${Date.now()}.${extName}`,
  });
  return fileHandle.createWritable();
}
