// Utility for Web Crypto API RSA-OAEP E2EE

// Helper to convert ArrayBuffer to Base64
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Helper to convert Base64 to ArrayBuffer
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary_string = atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Generates an RSA-OAEP key pair.
 * Returns the CryptoKey private key (to save in IndexedDB)
 * and the Base64 SPKI public key (to send to server).
 */
export async function generateKeyPair(): Promise<{ privateKey: CryptoKey; publicKeyBase64: string }> {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // extractable
    ["encrypt", "decrypt"]
  );

  const exportedPublicKey = await window.crypto.subtle.exportKey(
    "spki",
    keyPair.publicKey
  );
  
  const publicKeyBase64 = bufferToBase64(exportedPublicKey);

  return {
    privateKey: keyPair.privateKey,
    publicKeyBase64
  };
}

/**
 * Imports a Base64 SPKI public key and uses it to encrypt text.
 */
export async function encryptMessage(text: string, publicKeyBase64: string): Promise<string> {
  // Import the public key
  const publicKeyBuffer = base64ToBuffer(publicKeyBase64);
  const publicKey = await window.crypto.subtle.importKey(
    "spki",
    publicKeyBuffer,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true,
    ["encrypt"]
  );

  const enc = new TextEncoder();
  const encodedMessage = enc.encode(text);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "RSA-OAEP"
    },
    publicKey,
    encodedMessage
  );

  return bufferToBase64(encryptedBuffer);
}

/**
 * Decrypts a Base64 encrypted message using the local Private Key.
 */
export async function decryptMessage(encryptedBase64: string, privateKey: CryptoKey): Promise<string> {
  const encryptedBuffer = base64ToBuffer(encryptedBase64);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: "RSA-OAEP"
    },
    privateKey,
    encryptedBuffer
  );

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}
