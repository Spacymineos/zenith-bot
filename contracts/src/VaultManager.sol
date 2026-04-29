// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./StablecoinToken.sol";
import "./PriceOracle.sol";

/// @title VaultManager — multi-stablecoin collateral vault for Zenith
contract VaultManager is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    uint256 private constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant LIQUIDATION_THRESHOLD = 110; // 110%
    uint256 public constant LIQUIDATOR_BONUS = 5;        // 5%

    struct StablecoinConfig {
        address token;
        uint256 collateralRatio; // e.g. 15000 = 150.00%
        uint256 stabilityFee;   // annual bps (200 = 2%)
        bytes32 oracleAsset;
        bool enabled;
    }

    struct Vault {
        uint256 collateral; // locked Zenith Coin (wei)
        uint256 debt;       // minted stablecoin (18 dec)
        uint256 feeAccruedAt;
    }

    mapping(bytes32 => StablecoinConfig) public configs;
    bytes32[] public supportedStablecoins;
    mapping(address => mapping(bytes32 => Vault)) public vaults;

    PriceOracle public oracle;
    bytes32 public coinOracleKey;

    event Deposited(address indexed user, bytes32 indexed stablecoin, uint256 amount, uint256 timestamp);
    event Minted(address indexed user, bytes32 indexed stablecoin, uint256 amount, uint256 timestamp);
    event Repaid(address indexed user, bytes32 indexed stablecoin, uint256 amount, uint256 feeBurned, uint256 timestamp);
    event Liquidated(address indexed liquidator, address indexed user, bytes32 indexed stablecoin, uint256 debtRepaid, uint256 collateralSeized, uint256 bonus, uint256 timestamp);
    event CollateralWithdrawn(address indexed user, bytes32 indexed stablecoin, uint256 amount, uint256 timestamp);
    event StablecoinAdded(bytes32 indexed key, address token, uint256 collateralRatio, uint256 stabilityFee);

    constructor(address admin, address _oracle, bytes32 _coinOracleKey) {
        require(_oracle != address(0), "VaultManager: zero oracle");
        oracle = PriceOracle(_oracle);
        coinOracleKey = _coinOracleKey;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    receive() external payable {}

    function addStablecoin(bytes32 key, address token, uint256 collateralRatio, uint256 stabilityFee, bytes32 oracleAsset) external onlyRole(ADMIN_ROLE) {
        require(token != address(0) && !configs[key].enabled, "VaultManager: invalid");
        configs[key] = StablecoinConfig(token, collateralRatio, stabilityFee, oracleAsset, true);
        supportedStablecoins.push(key);
        emit StablecoinAdded(key, token, collateralRatio, stabilityFee);
    }

    function deposit(bytes32 stablecoin) external payable {
        require(configs[stablecoin].enabled && msg.value > 0, "VaultManager: invalid");
        _accrue(msg.sender, stablecoin);
        vaults[msg.sender][stablecoin].collateral += msg.value;
        emit Deposited(msg.sender, stablecoin, msg.value, block.timestamp);
    }

    function mint(bytes32 stablecoin, uint256 amount) external {
        require(configs[stablecoin].enabled && amount > 0, "VaultManager: invalid");
        _accrue(msg.sender, stablecoin);
        Vault storage v = vaults[msg.sender][stablecoin];
        uint256 newDebt = v.debt + amount;
        require(_isHealthy(v.collateral, newDebt, stablecoin), "VaultManager: below ratio");
        v.debt = newDebt;
        if (v.feeAccruedAt == 0) v.feeAccruedAt = block.timestamp;
        StablecoinToken(configs[stablecoin].token).mint(msg.sender, amount);
        emit Minted(msg.sender, stablecoin, amount, block.timestamp);
    }

    function repay(bytes32 stablecoin, uint256 amount) external {
        require(configs[stablecoin].enabled && amount > 0, "VaultManager: invalid");
        _accrue(msg.sender, stablecoin);
        Vault storage v = vaults[msg.sender][stablecoin];
        require(amount <= v.debt, "VaultManager: repay exceeds debt");
        uint256 feeSnapshot = _calcFee(v, stablecoin);
        StablecoinToken(configs[stablecoin].token).burn(msg.sender, amount);
        v.debt -= amount;
        emit Repaid(msg.sender, stablecoin, amount, feeSnapshot, block.timestamp);
    }

    function withdraw(bytes32 stablecoin, uint256 amount) external {
        require(configs[stablecoin].enabled, "VaultManager: unknown");
        _accrue(msg.sender, stablecoin);
        Vault storage v = vaults[msg.sender][stablecoin];
        require(v.collateral >= amount, "VaultManager: insufficient collateral");
        uint256 remaining = v.collateral - amount;
        require(v.debt == 0 || _isHealthy(remaining, v.debt, stablecoin), "VaultManager: below ratio");
        v.collateral = remaining;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "VaultManager: transfer failed");
        emit CollateralWithdrawn(msg.sender, stablecoin, amount, block.timestamp);
    }

    function liquidate(address user, bytes32 stablecoin) external {
        require(configs[stablecoin].enabled && user != msg.sender, "VaultManager: invalid");
        _accrue(user, stablecoin);
        Vault storage v = vaults[user][stablecoin];
        require(v.debt > 0, "VaultManager: no debt");
        require(!_aboveLiqThreshold(v.collateral, v.debt, stablecoin), "VaultManager: healthy");
        uint256 debtRepaid = v.debt;
        uint256 coinDebt = _stabToCoin(debtRepaid, stablecoin);
        uint256 bonus = (coinDebt * LIQUIDATOR_BONUS) / 100;
        uint256 seized = coinDebt + bonus;
        if (seized > v.collateral) seized = v.collateral;
        v.debt = 0;
        v.collateral -= seized;
        StablecoinToken(configs[stablecoin].token).burn(msg.sender, debtRepaid);
        (bool ok, ) = payable(msg.sender).call{value: seized}("");
        require(ok, "VaultManager: transfer failed");
        emit Liquidated(msg.sender, user, stablecoin, debtRepaid, seized, bonus, block.timestamp);
    }

    function getVaultStatus(address user, bytes32 stablecoin) external view returns (uint256 collateral, uint256 debt, uint256 ratio, uint256 liquidationPrice) {
        Vault memory v = vaults[user][stablecoin];
        collateral = v.collateral;
        debt = v.debt;
        if (debt == 0) { ratio = type(uint256).max; liquidationPrice = 0; return (collateral, debt, ratio, liquidationPrice); }
        uint256 coinPrice = oracle.getPrice(coinOracleKey);
        uint256 stabPrice = oracle.getPrice(configs[stablecoin].oracleAsset);
        uint256 colUsd = (collateral * coinPrice) / 1e18;
        uint256 debtUsd = (debt * stabPrice) / 1e18;
        ratio = debtUsd > 0 ? (colUsd * 10000) / debtUsd : type(uint256).max;
        if (collateral > 0) liquidationPrice = (debt * stabPrice * LIQUIDATION_THRESHOLD) / (collateral * 100);
    }

    function supportedStablecoinsCount() external view returns (uint256) { return supportedStablecoins.length; }

    function _accrue(address user, bytes32 stablecoin) internal {
        Vault storage v = vaults[user][stablecoin];
        if (v.feeAccruedAt == 0 || v.debt == 0) { v.feeAccruedAt = block.timestamp; return; }
        uint256 fee = _calcFee(v, stablecoin);
        if (fee > 0) v.debt += fee;
        v.feeAccruedAt = block.timestamp;
    }

    function _calcFee(Vault memory v, bytes32 stablecoin) internal view returns (uint256) {
        if (v.feeAccruedAt == 0 || v.debt == 0) return 0;
        uint256 elapsed = block.timestamp - v.feeAccruedAt;
        return (v.debt * configs[stablecoin].stabilityFee * elapsed) / (SECONDS_PER_YEAR * 10000);
    }

    function _isHealthy(uint256 collateral, uint256 debt, bytes32 stablecoin) internal view returns (bool) {
        if (debt == 0) return true;
        uint256 coinPrice = oracle.getPrice(coinOracleKey);
        uint256 stabPrice = oracle.getPrice(configs[stablecoin].oracleAsset);
        uint256 colUsd = (collateral * coinPrice) / 1e18;
        uint256 debtUsd = (debt * stabPrice) / 1e18;
        return (colUsd * 10000) >= (debtUsd * configs[stablecoin].collateralRatio);
    }

    function _aboveLiqThreshold(uint256 collateral, uint256 debt, bytes32 stablecoin) internal view returns (bool) {
        if (debt == 0) return true;
        uint256 coinPrice = oracle.getPrice(coinOracleKey);
        uint256 stabPrice = oracle.getPrice(configs[stablecoin].oracleAsset);
        uint256 colUsd = (collateral * coinPrice) / 1e18;
        uint256 debtUsd = (debt * stabPrice) / 1e18;
        return (colUsd * 100) >= (debtUsd * LIQUIDATION_THRESHOLD);
    }

    function _stabToCoin(uint256 stabAmount, bytes32 stablecoin) internal view returns (uint256) {
        uint256 stabPrice = oracle.getPrice(configs[stablecoin].oracleAsset);
        uint256 coinPrice = oracle.getPrice(coinOracleKey);
        return (stabAmount * stabPrice) / coinPrice;
    }
}
