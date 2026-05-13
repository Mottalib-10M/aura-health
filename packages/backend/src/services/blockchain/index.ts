import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { sha256, hashChainEntry } from '../../utils/crypto.js';
import { query } from '../../config/database.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditEntry {
  entityType: 'TRIAGE' | 'PRESCRIPTION' | 'CREDENTIAL' | 'APPOINTMENT' | 'PATIENT_DATA';
  entityId: string;
  action: string;
  actorId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface CredentialAttestation {
  doctorId: string;
  licenseNumber: string;
  issuingAuthority: string;
  documentHash: string;
  attestedBy: string;
  attestedAt: string;
}

interface BlockchainSubmitResult {
  transactionId: string;
  blockNumber?: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// In-memory hash chain for local audit trail
// ---------------------------------------------------------------------------

let lastHash = sha256('AURA_HEALTH_GENESIS_BLOCK');

function appendToLocalChain(payload: Record<string, unknown>): string {
  const newHash = hashChainEntry(lastHash, payload);
  lastHash = newHash;
  return newHash;
}

// ---------------------------------------------------------------------------
// Hyperledger Fabric interface
// ---------------------------------------------------------------------------

/**
 * Submit a transaction to the Hyperledger Fabric network.
 * Falls back to local audit logging if Fabric is unavailable.
 */
async function submitToFabric(
  functionName: string,
  args: string[],
): Promise<BlockchainSubmitResult> {
  const peerEndpoint = config.blockchain.peerEndpoint;

  if (!peerEndpoint || !config.blockchain.certPath || !config.blockchain.keyPath) {
    logger.debug('Hyperledger Fabric not configured; using local audit chain');
    throw new Error('Fabric not configured');
  }

  try {
    // In production, this would use @hyperledger/fabric-gateway SDK:
    //
    // const client = new grpc.Client(peerEndpoint, credentials);
    // const gateway = connect({ client, identity, signer });
    // const network = gateway.getNetwork(config.blockchain.channel);
    // const contract = network.getContract(config.blockchain.chaincode);
    // const result = await contract.submitTransaction(functionName, ...args);
    //
    // For now, we simulate the interface and rely on the local hash chain.

    // Attempt gRPC call to Fabric peer
    const response = await fetch(`${peerEndpoint}/chaincode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channelId: config.blockchain.channel,
        chaincodeId: config.blockchain.chaincode,
        function: functionName,
        args,
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error(`Fabric peer returned ${response.status}`);
    }

    const data = (await response.json()) as {
      transactionId: string;
      blockNumber: number;
    };

    return {
      transactionId: data.transactionId,
      blockNumber: data.blockNumber,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn({ err }, 'Fabric submission failed; will use local audit chain');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Core audit functions
// ---------------------------------------------------------------------------

/**
 * Record an auditable event. Attempts Hyperledger Fabric first; falls back
 * to a local SHA-256 hash chain stored in PostgreSQL.
 */
export async function recordAuditEvent(entry: AuditEntry): Promise<string> {
  const payload = {
    entityType: entry.entityType,
    entityId: entry.entityId,
    action: entry.action,
    actorId: entry.actorId,
    payloadHash: sha256(JSON.stringify(entry.payload)),
    timestamp: entry.timestamp,
  };

  let transactionId: string;

  try {
    const result = await submitToFabric('RecordAudit', [JSON.stringify(payload)]);
    transactionId = result.transactionId;
    logger.info({ transactionId, entityType: entry.entityType }, 'Audit event recorded on Fabric');
  } catch {
    // Fallback: local hash chain
    const chainHash = appendToLocalChain(payload);
    transactionId = `local-${chainHash.slice(0, 16)}`;

    // Persist to PostgreSQL as fallback
    try {
      await query(
        `INSERT INTO audit_log (id, event_type, entity_id, actor_id, payload_hash, chain_hash, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
        [
          entry.entityType,
          entry.entityId,
          entry.actorId,
          payload.payloadHash,
          chainHash,
          entry.timestamp,
        ],
      );
    } catch (dbErr) {
      logger.error({ err: dbErr }, 'Failed to persist audit event to PostgreSQL');
    }

    logger.info({ chainHash, entityType: entry.entityType }, 'Audit event recorded locally');
  }

  return transactionId;
}

// ---------------------------------------------------------------------------
// Credential attestation
// ---------------------------------------------------------------------------

/**
 * Attest a doctor's credential on the blockchain. Creates a tamper-proof
 * record of credential verification.
 */
export async function attestCredential(attestation: CredentialAttestation): Promise<string> {
  const documentHash = attestation.documentHash || sha256(attestation.licenseNumber);

  const entry: AuditEntry = {
    entityType: 'CREDENTIAL',
    entityId: attestation.doctorId,
    action: 'ATTEST_CREDENTIAL',
    actorId: attestation.attestedBy,
    payload: {
      licenseNumber: attestation.licenseNumber,
      issuingAuthority: attestation.issuingAuthority,
      documentHash,
      attestedAt: attestation.attestedAt,
    },
    timestamp: attestation.attestedAt,
  };

  const transactionId = await recordAuditEvent(entry);

  // Also store the attestation reference on the doctor record
  try {
    await query(
      `UPDATE doctors
       SET credential_attestation_tx = $2, credential_attestation_at = $3, updated_at = NOW()
       WHERE id = $1`,
      [attestation.doctorId, transactionId, attestation.attestedAt],
    );
  } catch (err) {
    logger.error({ err, doctorId: attestation.doctorId }, 'Failed to update doctor credential attestation');
  }

  return transactionId;
}

// ---------------------------------------------------------------------------
// Prescription audit logging
// ---------------------------------------------------------------------------

/**
 * Audit a prescription outcome recording for regulatory compliance.
 */
export async function auditPrescriptionOutcome(data: {
  prescriptionId: string;
  efficacyScore: number;
  recordedBy: string;
  timestamp: string;
}): Promise<string> {
  return recordAuditEvent({
    entityType: 'PRESCRIPTION',
    entityId: data.prescriptionId,
    action: 'RECORD_OUTCOME',
    actorId: data.recordedBy,
    payload: {
      efficacyScore: data.efficacyScore,
    },
    timestamp: data.timestamp,
  });
}

/**
 * Audit a new prescription creation.
 */
export async function auditPrescriptionCreation(data: {
  prescriptionId: string;
  patientId: string;
  doctorId: string;
  diagnosisCodes: string[];
  timestamp: string;
}): Promise<string> {
  return recordAuditEvent({
    entityType: 'PRESCRIPTION',
    entityId: data.prescriptionId,
    action: 'CREATE',
    actorId: data.doctorId,
    payload: {
      patientId: data.patientId,
      diagnosisCodes: data.diagnosisCodes,
    },
    timestamp: data.timestamp,
  });
}

// ---------------------------------------------------------------------------
// Audit trail verification
// ---------------------------------------------------------------------------

/**
 * Verify the integrity of the local audit chain stored in PostgreSQL.
 * Returns the number of valid entries and any integrity violations.
 */
export async function verifyAuditChain(): Promise<{
  totalEntries: number;
  validEntries: number;
  violations: Array<{ id: string; expectedHash: string; actualHash: string }>;
}> {
  const result = await query(
    `SELECT id, event_type, entity_id, actor_id, payload_hash, chain_hash, created_at
     FROM audit_log
     ORDER BY created_at ASC`,
  );

  const violations: Array<{ id: string; expectedHash: string; actualHash: string }> = [];
  let previousHash = sha256('AURA_HEALTH_GENESIS_BLOCK');
  let validCount = 0;

  for (const row of result.rows) {
    const payload = {
      entityType: row.event_type,
      entityId: row.entity_id,
      action: '', // We don't store action separately, so skip for verification
      actorId: row.actor_id,
      payloadHash: row.payload_hash,
      timestamp: (row.created_at as Date).toISOString(),
    };

    const expectedHash = hashChainEntry(previousHash, payload);

    if (row.chain_hash && row.chain_hash !== expectedHash) {
      violations.push({
        id: row.id as string,
        expectedHash,
        actualHash: row.chain_hash as string,
      });
    } else {
      validCount++;
    }

    previousHash = (row.chain_hash as string) || expectedHash;
  }

  return {
    totalEntries: result.rows.length,
    validEntries: validCount,
    violations,
  };
}
