import crypto from 'crypto';

/**
 * Secure authentication service
 * Uses PBKDF2 for PIN hashing (more predictable than bcrypt for numeric PINs)
 */

const HASH_ALGORITHM = 'sha256';
const ITERATIONS = 100000;
const KEY_LENGTH = 64;
const SALT_LENGTH = 32;

export async function hashPin(pin: string): Promise<string> {
    // Validate PIN format
    if (!pin || typeof pin !== 'string') {
        throw new Error('Invalid PIN format');
    }

    if (!/^\d{4,6}$/.test(pin.trim())) {
        throw new Error('PIN must be 4-6 digits');
    }

    const cleanPin = pin.trim();

    // Generate random salt
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key using PBKDF2
    const derivedKey = crypto.pbkdf2Sync(
        cleanPin,
        salt,
        ITERATIONS,
        KEY_LENGTH,
        HASH_ALGORITHM
    );

    // Combine salt + derivedKey and encode as base64
    const combined = Buffer.concat([salt, derivedKey]);
    return combined.toString('base64');
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
    try {
        if (!pin || !pinHash) {
            return false;
        }

        const cleanPin = pin.trim();

        // Decode stored hash
        const combined = Buffer.from(pinHash, 'base64');

        // Extract salt and derive new key with same salt
        const salt = combined.slice(0, SALT_LENGTH);
        const storedKey = combined.slice(SALT_LENGTH);

        const derivedKey = crypto.pbkdf2Sync(
            cleanPin,
            salt,
            ITERATIONS,
            KEY_LENGTH,
            HASH_ALGORITHM
        );

        // Compare constant-time
        return crypto.timingSafeEqual(derivedKey, storedKey);
    } catch (error) {
        return false;
    }
}

export function validatePin(pin: string): { valid: boolean; error?: string } {
    if (!pin || typeof pin !== 'string') {
        return { valid: false, error: 'PIN is required' };
    }

    const cleaned = pin.trim();
    if (!/^\d{4,}$/.test(cleaned)) {
        return { valid: false, error: 'PIN must contain only digits (minimum 4)' };
    }

    if (cleaned.length > 20) {
        return { valid: false, error: 'PIN is too long (max 20 digits)' };
    }

    return { valid: true };
}

export function generateTemporaryPin(): string {
    return Math.random().toString().slice(2, 8); // 6 random digits
}
