// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * Storage-based IncidentRegistry - alternative to events-only approach.
 * Stores reportId -> hash mapping on-chain for comparison gas testing.
 * Higher gas cost than events-only but enables on-chain data queries.
 */
contract IncidentRegistryStorage {
    event IncidentVerified(uint256 indexed reportId, bytes32 hashValue, uint256 timestamp);

    mapping(uint256 => bytes32) private _incidentHashes;
    mapping(uint256 => uint256) private _incidentTimestamps;

    function recordIncident(uint256 reportId, bytes32 hashValue) external {
        require(_incidentHashes[reportId] == bytes32(0), "Incident already recorded");
        _incidentHashes[reportId] = hashValue;
        _incidentTimestamps[reportId] = block.timestamp;
        emit IncidentVerified(reportId, hashValue, block.timestamp);
    }

    function getIncidentHash(uint256 reportId) external view returns (bytes32) {
        return _incidentHashes[reportId];
    }

    function getIncidentTimestamp(uint256 reportId) external view returns (uint256) {
        return _incidentTimestamps[reportId];
    }

    function isRecorded(uint256 reportId) external view returns (bool) {
        return _incidentHashes[reportId] != bytes32(0);
    }
}
