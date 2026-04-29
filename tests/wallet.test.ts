import { describe, it, expect } from "vitest";
import { ethers } from "ethers";
import crypto from "crypto";

function encryptKey(privateKey: string, secret: string) {
    const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.alloc(32, secret).slice(0, 32), Buffer.alloc(12, 0));
    let encrypted = cipher.update(privateKey, "utf8", "hex");
    encrypted += cipher.final("hex");
    return { encrypted, authTag: cipher.getAuthTag().toString("hex") };
}

function generateWallet(secret: string) {
    const wallet = ethers.Wallet.createRandom();
    const { encrypted, authTag } = encryptKey(wallet.privateKey, secret);
    return { address: wallet.address, encryptedKey: `${encrypted}:${authTag}` };
}

function decryptKey(encryptedKey: string, secret: string) {
    const [encrypted, authTag] = encryptedKey.split(":");
    if (!encrypted || !authTag) throw new Error("Invalid encryptedKey format");
    const decipher = crypto.createDecipheriv("aes-256-gcm", Buffer.alloc(32, secret).slice(0, 32), Buffer.alloc(12, 0));
    decipher.setAuthTag(Buffer.from(authTag, "hex"));
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

function validateAddress(address: string) {
    try {
        return ethers.isAddress(address);
    } catch {
        return false;
    }
}

describe("wallet tests", () => {
  it("generateWallet() returns an object with address (valid 0x format) and encryptedKey", () => {
    const secret = "mysecretpassword1234567890123456";
    const wallet = generateWallet(secret);
    expect(wallet.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    expect(wallet.encryptedKey).toContain(":");
  });

  it("decryptKey(encryptedKey, secret) recovers the original private key", () => {
    const secret = "mysecretpassword1234567890123456";
    const actualWallet = ethers.Wallet.createRandom();
    const { encrypted, authTag } = encryptKey(actualWallet.privateKey, secret);
    const recovered = decryptKey(`${encrypted}:${authTag}`, secret);
    expect(recovered).toBe(actualWallet.privateKey);
  });

  it('validateAddress("0x123") returns false (too short)', () => {
    expect(validateAddress("0x123")).toBe(false);
  });

  it("validateAddress(ethers.Wallet.createRandom().address) returns true", () => {
    expect(validateAddress(ethers.Wallet.createRandom().address)).toBe(true);
  });
});
