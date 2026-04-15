/**
 * Solana program instruction builders for Schema Registry,
 * Attestation Engine V2, and Groth16 Verifier.
 *
 * Follows the same raw TransactionInstruction pattern used in contracts.ts.
 * Discriminators are the first 8 bytes of SHA-256("global:<method_name>").
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";
import { deployedAddresses } from "../contracts/deployedAddresses";
import {
  SCHEMA_REGISTRY_PROGRAM_ID,
  ATTESTATION_ENGINE_V2_PROGRAM_ID,
} from "./schema";

const GROTH16_VERIFIER_PROGRAM_ID = new PublicKey(
  deployedAddresses.groth16Verifier
);

const STEALTH_ANNOUNCER_PROGRAM_ID = new PublicKey(
  deployedAddresses.stealthAnnouncer
);

// ---------------------------------------------------------------------------
// Discriminator helper
// ---------------------------------------------------------------------------

function anchorDiscriminator(methodName: string): Buffer {
  const hash = sha256(`global:${methodName}`);
  return Buffer.from(hash.slice(0, 8));
}

// ---------------------------------------------------------------------------
// Borsh encoding helpers
// ---------------------------------------------------------------------------

function encodeString(s: string): Buffer {
  const bytes = Buffer.from(s, "utf-8");
  const len = Buffer.alloc(4);
  len.writeUInt32LE(bytes.length);
  return Buffer.concat([len, bytes]);
}

function encodeVecU8(data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(data.length);
  return Buffer.concat([len, Buffer.from(data)]);
}

function encodeBool(v: boolean): Buffer {
  return Buffer.from([v ? 1 : 0]);
}

function encodeOptionPubkey(pk: PublicKey | null): Buffer {
  if (pk === null) return Buffer.from([0]);
  return Buffer.concat([Buffer.from([1]), pk.toBuffer()]);
}

function encodeU64(n: number | bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(n));
  return buf;
}

function encodeFixedBytes(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes);
}

// ---------------------------------------------------------------------------
// Schema Registry instructions
// ---------------------------------------------------------------------------

export function buildRegisterSchemaInstruction(
  authority: PublicKey,
  schemaPda: PublicKey,
  schemaId: Uint8Array,
  name: string,
  fieldDefinitions: string,
  revocable: boolean,
  resolver: PublicKey | null,
  schemaExpirySlot: number | bigint
): TransactionInstruction {
  const data = Buffer.concat([
    anchorDiscriminator("register_schema"),
    encodeFixedBytes(schemaId),
    encodeString(name),
    encodeString(fieldDefinitions),
    encodeBool(revocable),
    encodeOptionPubkey(resolver),
    encodeU64(schemaExpirySlot),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: schemaPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      {
        pubkey: SystemProgram.programId,
        isSigner: false,
        isWritable: false,
      },
    ],
    programId: SCHEMA_REGISTRY_PROGRAM_ID,
    data,
  });
}

export function buildAddDelegateInstruction(
  authority: PublicKey,
  schemaPda: PublicKey,
  delegate: PublicKey
): TransactionInstruction {
  const data = Buffer.concat([
    anchorDiscriminator("add_delegate"),
    delegate.toBuffer(),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: schemaPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    programId: SCHEMA_REGISTRY_PROGRAM_ID,
    data,
  });
}

export function buildRemoveDelegateInstruction(
  authority: PublicKey,
  schemaPda: PublicKey,
  delegate: PublicKey
): TransactionInstruction {
  const data = Buffer.concat([
    anchorDiscriminator("remove_delegate"),
    delegate.toBuffer(),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: schemaPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    programId: SCHEMA_REGISTRY_PROGRAM_ID,
    data,
  });
}

export function buildDeprecateSchemaInstruction(
  authority: PublicKey,
  schemaPda: PublicKey
): TransactionInstruction {
  const data = anchorDiscriminator("deprecate_schema");

  return new TransactionInstruction({
    keys: [
      { pubkey: schemaPda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    programId: SCHEMA_REGISTRY_PROGRAM_ID,
    data,
  });
}

// ---------------------------------------------------------------------------
// Attestation Engine V2 instructions
// ---------------------------------------------------------------------------

export function buildAttestInstruction(
  issuer: PublicKey,
  schemaPda: PublicKey,
  attestationPda: PublicKey,
  stealthAddressHash: Uint8Array,
  data: Uint8Array,
  expirationSlot: number | bigint,
  refUid: Uint8Array,
  resolverProgram?: PublicKey
): TransactionInstruction {
  const ixData = Buffer.concat([
    anchorDiscriminator("attest"),
    encodeFixedBytes(stealthAddressHash),
    encodeVecU8(data),
    encodeU64(expirationSlot),
    encodeFixedBytes(refUid),
  ]);

  const keys = [
    { pubkey: schemaPda, isSigner: false, isWritable: false },
    { pubkey: attestationPda, isSigner: false, isWritable: true },
    { pubkey: issuer, isSigner: true, isWritable: true },
  ];

  // Keep account ordering stable for Anchor account deserialization:
  // resolver_program is optional but appears before system_program.
  // When resolver is absent, pass Pubkey::default() as a placeholder slot.
  keys.push({
    pubkey: resolverProgram ?? PublicKey.default,
    isSigner: false,
    isWritable: false,
  });

  keys.push({
    pubkey: SystemProgram.programId,
    isSigner: false,
    isWritable: false,
  });

  return new TransactionInstruction({
    keys,
    programId: ATTESTATION_ENGINE_V2_PROGRAM_ID,
    data: ixData,
  });
}

export function buildRevokeInstruction(
  revoker: PublicKey,
  schemaPda: PublicKey,
  attestationPda: PublicKey,
  attestationUid: Uint8Array,
  resolverProgram?: PublicKey
): TransactionInstruction {
  const data = Buffer.concat([
    anchorDiscriminator("revoke"),
    encodeFixedBytes(attestationUid),
  ]);

  const keys = [
    { pubkey: schemaPda, isSigner: false, isWritable: false },
    { pubkey: attestationPda, isSigner: false, isWritable: true },
    { pubkey: revoker, isSigner: true, isWritable: false },
    {
      pubkey: resolverProgram ?? PublicKey.default,
      isSigner: false,
      isWritable: false,
    },
  ];

  return new TransactionInstruction({
    keys,
    programId: ATTESTATION_ENGINE_V2_PROGRAM_ID,
    data,
  });
}

// ---------------------------------------------------------------------------
// Groth16 Verifier V2 instruction
// ---------------------------------------------------------------------------

export function buildVerifyProofV2Instruction(
  caller: PublicKey,
  proofA: Uint8Array,
  proofB: Uint8Array,
  proofC: Uint8Array,
  merkleRoot: Uint8Array,
  attestationId: Uint8Array,
  externalNullifier: Uint8Array,
  nullifierHash: Uint8Array
): TransactionInstruction {
  const data = Buffer.concat([
    anchorDiscriminator("verify_proof_v2"),
    encodeFixedBytes(proofA),
    encodeFixedBytes(proofB),
    encodeFixedBytes(proofC),
    encodeFixedBytes(merkleRoot),
    encodeFixedBytes(attestationId),
    encodeFixedBytes(externalNullifier),
    encodeFixedBytes(nullifierHash),
  ]);

  return new TransactionInstruction({
    keys: [{ pubkey: caller, isSigner: true, isWritable: false }],
    programId: GROTH16_VERIFIER_PROGRAM_ID,
    data,
  });
}

// ---------------------------------------------------------------------------
// Stealth Announcer instruction
// ---------------------------------------------------------------------------

/**
 * Builds the `announce` instruction for the StealthAnnouncer program.
 *
 * Used by the attestation issuer to broadcast a stealth announcement so the
 * recipient's scanner can discover attestations issued to their stealth address.
 *
 * metadata layout for V2 attestations (130 bytes):
 *   byte[0]      = view_tag
 *   byte[1]      = 0xB2 (V2 marker)
 *   byte[2..34]  = schema_id [u8; 32]
 *   byte[34..66] = issuer pubkey [u8; 32]
 *   byte[66..98] = attestation_uid [u8; 32]
 *   byte[98..130]= nonce [u8; 32]
 */
export function buildAnnounceInstruction(
  caller: PublicKey,
  schemeId: number | bigint,
  stealthAddress: Uint8Array,
  ephemeralPubKey: Uint8Array,
  metadata: Uint8Array
): TransactionInstruction {
  const data = Buffer.concat([
    anchorDiscriminator("announce"),
    encodeU64(schemeId),
    encodeVecU8(stealthAddress),
    encodeVecU8(ephemeralPubKey),
    encodeVecU8(metadata),
  ]);

  return new TransactionInstruction({
    keys: [{ pubkey: caller, isSigner: true, isWritable: true }],
    programId: STEALTH_ANNOUNCER_PROGRAM_ID,
    data,
  });
}

// ---------------------------------------------------------------------------
// Account deserialization — SchemaPDA
// ---------------------------------------------------------------------------

const SCHEMA_PDA_DISCRIMINATOR = sha256("account:SchemaPDA").slice(0, 8);

export interface ParsedSchemaPDA {
  bump: number;
  schemaId: Uint8Array;
  authority: PublicKey;
  resolver: PublicKey;
  revocable: boolean;
  name: string;
  fieldDefinitions: string;
  version: number;
  delegates: PublicKey[];
  createdAt: bigint;
  schemaExpirySlot: bigint;
  deprecated: boolean;
}

function readString(buf: Buffer, offset: number): [string, number] {
  const len = buf.readUInt32LE(offset);
  offset += 4;
  const str = buf.slice(offset, offset + len).toString("utf-8");
  return [str, offset + len];
}

function readPubkey(buf: Buffer, offset: number): [PublicKey, number] {
  const pk = new PublicKey(buf.slice(offset, offset + 32));
  return [pk, offset + 32];
}

export function parseSchemaPDA(data: Buffer): ParsedSchemaPDA | null {
  if (data.length < 8) return null;

  const disc = data.slice(0, 8);
  if (!disc.every((v, i) => v === SCHEMA_PDA_DISCRIMINATOR[i])) return null;

  let offset = 8;

  const bump = data.readUInt8(offset);
  offset += 1;

  const schemaId = new Uint8Array(data.slice(offset, offset + 32));
  offset += 32;

  let authority: PublicKey;
  [authority, offset] = readPubkey(data, offset);

  let resolver: PublicKey;
  [resolver, offset] = readPubkey(data, offset);

  const revocable = data.readUInt8(offset) === 1;
  offset += 1;

  let name: string;
  [name, offset] = readString(data, offset);

  let fieldDefinitions: string;
  [fieldDefinitions, offset] = readString(data, offset);

  const version = data.readUInt8(offset);
  offset += 1;

  const delegateCount = data.readUInt32LE(offset);
  offset += 4;
  const delegates: PublicKey[] = [];
  for (let i = 0; i < delegateCount; i++) {
    let d: PublicKey;
    [d, offset] = readPubkey(data, offset);
    delegates.push(d);
  }

  const createdAt = data.readBigUInt64LE(offset);
  offset += 8;

  const schemaExpirySlot = data.readBigUInt64LE(offset);
  offset += 8;

  const deprecated = data.readUInt8(offset) === 1;

  return {
    bump,
    schemaId,
    authority,
    resolver,
    revocable,
    name,
    fieldDefinitions,
    version,
    delegates,
    createdAt,
    schemaExpirySlot,
    deprecated,
  };
}

// ---------------------------------------------------------------------------
// Account deserialization — AttestationPDA
// ---------------------------------------------------------------------------

const ATTESTATION_PDA_DISCRIMINATOR = sha256("account:AttestationPDA").slice(
  0,
  8
);

export interface ParsedAttestationPDA {
  bump: number;
  uid: Uint8Array;
  schemaPda: PublicKey;
  schemaId: Uint8Array;
  issuer: PublicKey;
  stealthAddressHash: Uint8Array;
  data: Uint8Array;
  createdAt: bigint;
  expirationSlot: bigint;
  revocationSlot: bigint;
  refUid: Uint8Array;
}

export function parseAttestationPDA(
  data: Buffer
): ParsedAttestationPDA | null {
  if (data.length < 8) return null;

  const disc = data.slice(0, 8);
  if (!disc.every((v, i) => v === ATTESTATION_PDA_DISCRIMINATOR[i])) {
    return null;
  }

  let offset = 8;

  const bump = data.readUInt8(offset);
  offset += 1;

  const uid = new Uint8Array(data.slice(offset, offset + 32));
  offset += 32;

  let schemaPda: PublicKey;
  [schemaPda, offset] = readPubkey(data, offset);

  const schemaId = new Uint8Array(data.slice(offset, offset + 32));
  offset += 32;

  let issuer: PublicKey;
  [issuer, offset] = readPubkey(data, offset);

  const stealthAddressHash = new Uint8Array(data.slice(offset, offset + 32));
  offset += 32;

  const dataLen = data.readUInt32LE(offset);
  offset += 4;
  const attestData = new Uint8Array(data.slice(offset, offset + dataLen));
  offset += dataLen;

  const createdAt = data.readBigUInt64LE(offset);
  offset += 8;

  const expirationSlot = data.readBigUInt64LE(offset);
  offset += 8;

  const revocationSlot = data.readBigUInt64LE(offset);
  offset += 8;

  const refUid = new Uint8Array(data.slice(offset, offset + 32));

  return {
    bump,
    uid,
    schemaPda,
    schemaId,
    issuer,
    stealthAddressHash,
    data: attestData,
    createdAt,
    expirationSlot,
    revocationSlot,
    refUid,
  };
}

// ---------------------------------------------------------------------------
// On-chain fetch helpers
// ---------------------------------------------------------------------------

export async function fetchSchemaPDA(
  connection: Connection,
  schemaPdaAddress: PublicKey
): Promise<ParsedSchemaPDA | null> {
  const info = await connection.getAccountInfo(schemaPdaAddress);
  if (!info?.data) return null;
  return parseSchemaPDA(Buffer.from(info.data));
}

export async function fetchAllSchemas(
  connection: Connection
): Promise<{ address: PublicKey; schema: ParsedSchemaPDA }[]> {
  const accounts = await connection.getProgramAccounts(
    SCHEMA_REGISTRY_PROGRAM_ID,
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: Buffer.from(SCHEMA_PDA_DISCRIMINATOR).toString("base64"),
            encoding: "base64",
          },
        },
      ],
    }
  );

  const results: { address: PublicKey; schema: ParsedSchemaPDA }[] = [];
  for (const { pubkey, account } of accounts) {
    const parsed = parseSchemaPDA(Buffer.from(account.data));
    if (parsed) results.push({ address: pubkey, schema: parsed });
  }
  return results;
}

export async function fetchAttestationPDA(
  connection: Connection,
  attestationPdaAddress: PublicKey
): Promise<ParsedAttestationPDA | null> {
  const info = await connection.getAccountInfo(attestationPdaAddress);
  if (!info?.data) return null;
  return parseAttestationPDA(Buffer.from(info.data));
}

export async function fetchAllAttestations(
  connection: Connection
): Promise<{ address: PublicKey; attestation: ParsedAttestationPDA }[]> {
  const accounts = await connection.getProgramAccounts(
    ATTESTATION_ENGINE_V2_PROGRAM_ID,
    {
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: Buffer.from(ATTESTATION_PDA_DISCRIMINATOR).toString("base64"),
            encoding: "base64",
          },
        },
      ],
    }
  );

  const results: { address: PublicKey; attestation: ParsedAttestationPDA }[] = [];
  for (const { pubkey, account } of accounts) {
    const parsed = parseAttestationPDA(Buffer.from(account.data));
    if (parsed) results.push({ address: pubkey, attestation: parsed });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Hex helpers
// ---------------------------------------------------------------------------

export function bytesToHex(bytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    bytes[i / 2] = parseInt(clean.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert a hex-encoded 32-byte Solana public key to base58.
 *
 * The WASM scanner serialises pubkeys as `0x{64 hex chars}` (32 raw bytes).
 * The chain-discovery path already returns base58 from `PublicKey.toBase58()`.
 * This function handles both cases — if the string doesn't start with "0x" it
 * is assumed to already be base58 and is returned unchanged.
 */
export function hexPubkeyToBase58(addr: string): string {
  if (!addr.startsWith("0x") && !addr.startsWith("0X")) return addr;
  try {
    const bytes = hexToBytes(addr);
    if (bytes.length !== 32) return addr;
    return new PublicKey(bytes).toBase58();
  } catch {
    return addr; // fallback — never crash the UI
  }
}
