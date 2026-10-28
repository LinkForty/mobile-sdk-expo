/**
 * An RFC 4122 version 4 UUID string. Not a security token: `Math.random` is
 * enough for session and event ids and avoids a native crypto dependency.
 */
export function randomUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
