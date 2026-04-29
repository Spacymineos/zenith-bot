// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title MintController — daily Zenith Coin claim + work-reward minter for Zenith
/// @dev  Native Zenith Coin is delivered by sending ETH (the native gas token) from a
///       funded treasury that is passed in at deploy time.
contract MintController is AccessControl {
    bytes32 public constant BOT_ROLE = keccak256("BOT_ROLE");

    // ── State ────────────────────────────────────────────────────────────────
    uint256 public immutable deployedAt;

    /// @notice Starting daily reward (100 Zenith Coin)
    uint256 public constant BASE_REWARD = 100 ether;

    /// @notice Halving period: 30 days in seconds
    uint256 public constant HALVING_PERIOD = 30 days;

    /// @notice 24-hour cooldown per address
    uint256 public constant CLAIM_COOLDOWN = 24 hours;

    mapping(address => uint256) public lastClaim;

    // ── Treasury ─────────────────────────────────────────────────────────────
    address payable public treasury;

    // ── Events ───────────────────────────────────────────────────────────────
    event DailyClaimed(address indexed recipient, uint256 amount, uint256 timestamp);
    event WorkMinted(address indexed recipient, uint256 amount, uint256 timestamp);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    // ── Constructor ──────────────────────────────────────────────────────────
    constructor(address admin, address payable _treasury) {
        require(_treasury != address(0), "MintController: zero treasury");
        deployedAt = block.timestamp;
        treasury = _treasury;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(BOT_ROLE, admin);
    }

    // Allow the contract to receive native Zenith Coin for re-distribution
    receive() external payable {}

    // ── Public ───────────────────────────────────────────────────────────────

    /// @notice Claim daily shrinking Zenith Coin reward (24h cooldown per address)
    function claimDaily(address recipient) external {
        require(
            block.timestamp >= lastClaim[recipient] + CLAIM_COOLDOWN,
            "MintController: cooldown active"
        );
        lastClaim[recipient] = block.timestamp;

        uint256 amount = currentReward();
        _sendCoin(recipient, amount);
        emit DailyClaimed(recipient, amount, block.timestamp);
    }

    /// @notice Work-reward mint — only callable by BOT_ROLE
    function mintWork(address recipient, uint256 amount) external onlyRole(BOT_ROLE) {
        require(amount > 0, "MintController: zero amount");
        _sendCoin(recipient, amount);
        emit WorkMinted(recipient, amount, block.timestamp);
    }

    // ── Owner Functions ──────────────────────────────────────────────────────

    /// @notice Update treasury wallet
    function setTreasury(address payable _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "MintController: zero address");
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    // ── Views ────────────────────────────────────────────────────────────────

    /// @notice Calculate current reward based on halvings since deployment
    function currentReward() public view returns (uint256) {
        uint256 halvings = (block.timestamp - deployedAt) / HALVING_PERIOD;
        // Cap halvings to avoid underflow (after ~2 years reward is ~0)
        if (halvings >= 64) return 0;
        return BASE_REWARD >> halvings;
    }

    /// @notice Seconds until `recipient` can claim again (0 = claimable now)
    function cooldownRemaining(address recipient) external view returns (uint256) {
        uint256 next = lastClaim[recipient] + CLAIM_COOLDOWN;
        if (block.timestamp >= next) return 0;
        return next - block.timestamp;
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _sendCoin(address recipient, uint256 amount) internal {
        require(amount > 0, "MintController: zero amount");
        // Try self balance first, fall back to treasury
        address source = address(this).balance >= amount
            ? address(this)
            : address(treasury);
        require(source.balance >= amount, "MintController: insufficient treasury");

        (bool ok, ) = payable(recipient).call{value: amount}("");
        require(ok, "MintController: transfer failed");
    }
}
