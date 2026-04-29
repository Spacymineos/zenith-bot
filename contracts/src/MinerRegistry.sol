// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title MinerRegistry — self-reported hashrate leaderboard for Zenith
contract MinerRegistry {
    // ── State ─────────────────────────────────────────────────────────────────
    struct MinerInfo {
        uint256 hashrate;    // KH/s
        uint256 updatedAt;
        uint256 index;       // position in minerList
        bool registered;
    }

    mapping(address => MinerInfo) private _miners;
    address[] private _minerList;

    // ── Events ────────────────────────────────────────────────────────────────
    event HashrateUpdated(address indexed miner, uint256 hashrate, uint256 timestamp);

    // ── Public Functions ──────────────────────────────────────────────────────

    /// @notice Submit or update self-reported hashrate in KH/s
    function submitHashrate(uint256 hashrateKHs) external {
        MinerInfo storage m = _miners[msg.sender];
        if (!m.registered) {
            m.index = _minerList.length;
            m.registered = true;
            _minerList.push(msg.sender);
        }
        m.hashrate = hashrateKHs;
        m.updatedAt = block.timestamp;
        emit HashrateUpdated(msg.sender, hashrateKHs, block.timestamp);
    }

    /// @notice Get hashrate for a specific miner
    function getHashrate(address miner) external view returns (uint256) {
        return _miners[miner].hashrate;
    }

    /// @notice Get total registered miner count
    function minerCount() external view returns (uint256) {
        return _minerList.length;
    }

    /// @notice Return top-n miners sorted descending by hashrate (insertion sort)
    function getTopMiners(uint256 n) external view returns (address[] memory addrs, uint256[] memory rates) {
        uint256 total = _minerList.length;
        if (n > total) n = total;

        // Copy to memory arrays for sorting
        address[] memory tempAddrs = new address[](total);
        uint256[] memory tempRates = new uint256[](total);
        for (uint256 i = 0; i < total; i++) {
            tempAddrs[i] = _minerList[i];
            tempRates[i] = _miners[_minerList[i]].hashrate;
        }

        // Insertion sort descending (acceptable for leaderboard sizes < 1000)
        for (uint256 i = 1; i < total; i++) {
            address keyAddr = tempAddrs[i];
            uint256 keyRate = tempRates[i];
            int256 j = int256(i) - 1;
            while (j >= 0 && tempRates[uint256(j)] < keyRate) {
                tempAddrs[uint256(j + 1)] = tempAddrs[uint256(j)];
                tempRates[uint256(j + 1)] = tempRates[uint256(j)];
                j--;
            }
            tempAddrs[uint256(j + 1)] = keyAddr;
            tempRates[uint256(j + 1)] = keyRate;
        }

        addrs = new address[](n);
        rates = new uint256[](n);
        for (uint256 i = 0; i < n; i++) {
            addrs[i] = tempAddrs[i];
            rates[i] = tempRates[i];
        }
    }
}
