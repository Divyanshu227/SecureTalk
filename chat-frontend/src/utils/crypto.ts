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

// -----------------------------------------------------------------------------
// CROSS-DEVICE KEY SYNCHRONIZATION (AES-GCM + PBKDF2)
// -----------------------------------------------------------------------------

/**
 * Derives an AES-GCM key from a password and an email (used as salt).
 */
async function deriveKeyFromPassword(password: string, saltString: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(saltString.toLowerCase()), // use lowercase email as salt
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/**
 * Exports the private key, encrypts it using the user's password, and returns Base64.
 * Output format: Base64( iv(12 bytes) + ciphertext )
 */
export async function encryptPrivateKeyWithPassword(
  privateKey: CryptoKey,
  password: string,
  email: string
): Promise<string> {
  // 1. Export Private Key to PKCS8
  const exported = await window.crypto.subtle.exportKey("pkcs8", privateKey);

  // 2. Derive AES Key
  const aesKey = await deriveKeyFromPassword(password, email);

  // 3. Encrypt with AES-GCM
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuf = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    exported
  );

  // 4. Combine IV and Ciphertext for storage
  const combined = new Uint8Array(iv.length + encryptedBuf.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedBuf), iv.length);

  return bufferToBase64(combined.buffer);
}

/**
 * Decrypts a Base64 encrypted private key using the user's password and imports it.
 */
export async function decryptPrivateKeyWithPassword(
  encryptedBase64: string,
  password: string,
  email: string
): Promise<CryptoKey> {
  const combinedBuffer = base64ToBuffer(encryptedBase64);
  const combined = new Uint8Array(combinedBuffer);

  // Extract IV (first 12 bytes) and ciphertext
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  // Derive AES Key
  const aesKey = await deriveKeyFromPassword(password, email);

  // Decrypt
  const decryptedPkcs8 = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    ciphertext
  );

  // Import back into CryptoKey
  return window.crypto.subtle.importKey(
    "pkcs8",
    decryptedPkcs8,
    {
      name: "RSA-OAEP",
      hash: "SHA-256",
    },
    true, // keep it extractable for future backups if needed
    ["decrypt"]
  );
}
