


export function assetsPrefix(assetsURL: string[]): string[] {
  const prefix = process.env.NODE_ENV === 'development' ? '/' : '/WebAV/'
  return assetsURL.map(url => `${prefix}${url}`)
}
