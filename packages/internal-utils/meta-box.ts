const createBoxHeader = (type: string, size: number): Uint8Array => {
  const buffer = new Uint8Array(8);
  const view = new DataView(buffer.buffer);
  view.setUint32(0, size); // Write size as a 32-bit unsigned integer
  for (let i = 0; i < 4; i++) {
    buffer[4 + i] = type.charCodeAt(i); // Write type as a 4-character string
  }
  return buffer;
};

const createHdlrBox = (): Uint8Array => {
  const tec = new TextEncoder();
  const handlerType = tec.encode('mdta');
  const nameBytes = tec.encode('mp4 handler');
  // header8 + ?8 + mdta4 + ?12 + nameSize + endFlag1
  const size = 8 + 8 + 4 + 12 + nameBytes.byteLength + 1;
  const buffer = new Uint8Array(size);
  const view = new DataView(buffer.buffer);

  // Box header
  buffer.set(createBoxHeader('hdlr', size), 0);

  // Full box header (version and flags)
  view.setUint32(8, 0);

  buffer.set(handlerType, 16);
  buffer.set(nameBytes, 32);

  return buffer;
};

const createKeysBox = (keys: string[]): Uint8Array => {
  const tec = new TextEncoder();
  const keyNamespace = tec.encode('mdta');
  const keyData = keys.map((key) => {
    const keyBuf = tec.encode(key);
    // size4 + namespace4 + keyBuf
    const size = 4 + 4 + keyBuf.byteLength;

    const entryBuf = new Uint8Array(size);
    const dv = new DataView(entryBuf.buffer);
    dv.setUint32(0, size);
    entryBuf.set(keyNamespace, 4);
    entryBuf.set(keyBuf, 4 + keyNamespace.byteLength);

    return entryBuf;
  });
  const keyDataSize = keyData.reduce((acc, cur) => acc + cur.byteLength, 0);

  const size = 16 + keyDataSize; // 16 bytes for the header and version/flags
  const buffer = new Uint8Array(size);
  const view = new DataView(buffer.buffer);

  // Box header
  buffer.set(createBoxHeader('keys', size), 0);

  // Full box header (version and flags)
  view.setUint32(8, 0);
  view.setUint32(12, keys.length); // Entry count

  // Keys
  let offset = 16;
  for (const keyBuf of keyData) {
    buffer.set(keyBuf, offset);
    offset += keyBuf.byteLength;
  }

  return buffer;
};

const createIlstBox = (data: Record<string, string>): Uint8Array => {
  const tec = new TextEncoder();
  const dataStrBuf = tec.encode('data');
  const valueData = Object.entries(data).map(([_, value], index) => {
    const keyId = index + 1; // Assuming keys start from 1
    const valueBytes = tec.encode(value);
    // size4 + keyId4 + valueSize4 + data4 + idx4 + ?4 + value
    const entrySize = 4 + 4 + 4 + 4 + 4 + 4 + valueBytes.byteLength;

    const buffer = new Uint8Array(entrySize);
    const view = new DataView(buffer.buffer);
    view.setUint32(0, entrySize);
    view.setUint32(4, keyId);

    view.setUint32(8, 16 + valueBytes.byteLength);
    buffer.set(dataStrBuf, 12); // 'data' type

    // data idx=1
    view.setUint32(16, 1);
    // Value
    buffer.set(valueBytes, 24);

    return buffer;
  });

  const valueDataSize = valueData.reduce((acc, cur) => acc + cur.byteLength, 0);
  const totalSizwe = 8 + valueDataSize;
  const buffer = new Uint8Array(totalSizwe);
  buffer.set(createBoxHeader('ilst', totalSizwe), 0);

  let offset = 8;
  for (const entry of valueData) {
    buffer.set(entry, offset);
    offset += entry.byteLength;
  }

  return buffer;
};

export const createMetaBox = (data: Record<string, string>): Uint8Array => {
  const hdlrBox = createHdlrBox();
  const keysBox = createKeysBox(Object.keys(data));
  const ilstBox = createIlstBox(data);

  const size = hdlrBox.length + keysBox.length + ilstBox.length;
  const buffer = new Uint8Array(size);

  // buffer.set(createBoxHeader('meta', size), 0);
  buffer.set(hdlrBox, 0);
  buffer.set(keysBox, hdlrBox.length);
  buffer.set(ilstBox, hdlrBox.length + keysBox.length);

  return buffer;
};
