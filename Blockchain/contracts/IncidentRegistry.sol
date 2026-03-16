// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * IncidentRegistry - Events-only contract for tamper-proof incident audit trail.
 *
 * Gas optimizations applied:
 * - Events-only design (no on-chain storage): ~24k gas vs ~48k for storage-based
 * - No timestamp in event: block.timestamp is derivable from blockNumber in tx receipt; saves ~256 gas/tx
 */
contract IncidentRegistry {
    event IncidentVerified(uint256 indexed reportId, bytes32 hashValue);

    function recordIncident(uint256 reportId, bytes32 hashValue) external {
        emit IncidentVerified(reportId, hashValue);
    }
}
